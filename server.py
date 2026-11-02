import json,sqlite3,uuid,re,os
from datetime import datetime,timezone,timedelta
from contextlib import contextmanager
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
ROOT=Path(__file__).resolve().parent
CATALOG={d['id']:d for d in json.loads((ROOT/'catalog.json').read_text(encoding='utf-8'))}
DB=Path(os.environ.get('BEDESI_DB',str(ROOT/'orders.sqlite3')))

@contextmanager
def database():
 connection=sqlite3.connect(DB)
 try:
  with connection:yield connection
 finally:connection.close()

with database() as db:
 db.execute('CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, request_id TEXT UNIQUE, payload TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)')
 db.execute('CREATE TABLE IF NOT EXISTS delivery_orders (id TEXT PRIMARY KEY, request_id TEXT UNIQUE, payload TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)')

def now_iso():return datetime.now(timezone.utc).isoformat()
def coupon_quote(subtotal,code,rules):
 if not code:return {'subtotal':subtotal,'discount':0,'total':subtotal,'coupon':''}
 from datetime import date
 rule=next((r for r in rules if r.get('active') is True and str(r.get('code','')).upper()==code),None)
 if not rule:return {'error':"This coupon isn't available. Check the code and try again."}
 if rule.get('expires') and str(rule['expires'])<date.today().isoformat():return {'error':'This coupon has expired.'}
 if subtotal<float(rule.get('minimum',0)):return {'error':f"This coupon needs an item total of INR {rule['minimum']} or more."}
 percent=max(0,min(100,float(rule.get('percent',0))))
 discount=min(subtotal,round(subtotal*percent/100,2),float(rule.get('maximum',subtotal)))
 return {'subtotal':subtotal,'discount':max(0,discount),'total':round(subtotal-max(0,discount),2),'coupon':code}
class Handler(SimpleHTTPRequestHandler):
 def is_local_admin(self):return self.client_address[0] in ('127.0.0.1','::1')
 def read_json(self):
  origin=self.headers.get('Origin')
  if origin and origin!='http://'+self.headers.get('Host',''):raise ValueError('Request origin is not allowed')
  if self.headers.get_content_type()!='application/json':raise ValueError('Send JSON data')
  size=int(self.headers.get('Content-Length','0'))
  if not 1<=size<=20000:raise ValueError('Invalid request size')
  data=json.loads(self.rfile.read(size))
  if not isinstance(data,dict):raise ValueError('Invalid request')
  return data
 def delivery_order(self):
  try:
   data=self.read_json();request=str(uuid.UUID(data.get('requestId','')))
   customer=data.get('customer')
   if not isinstance(customer,dict):raise ValueError('Please add your delivery details')
   clean={key:str(customer.get(key,'')).strip() for key in ('name','phone','address','city','pincode','notes')}
   if not 2<=len(clean['name'])<=80:raise ValueError('Please enter your name')
   if not re.fullmatch(r'[6-9]\d{9}',clean['phone']):raise ValueError('Please enter a valid 10-digit mobile number')
   if not 8<=len(clean['address'])<=500:raise ValueError('Please enter a complete delivery address')
   if not 2<=len(clean['city'])<=80:raise ValueError('Please enter your town')
   if not re.fullmatch(r'[1-9]\d{5}',clean['pincode']):raise ValueError('Please enter a valid 6-digit PIN code')
   if len(clean['notes'])>500:raise ValueError('Please keep instructions under 500 characters')
   items=data.get('items')
   if not isinstance(items,list) or not 1<=len(items)<=len(CATALOG):raise ValueError('Please add dishes to your order')
   validated=[];seen=set();subtotal=0
   for item in items:
    if not isinstance(item,dict):raise ValueError('Invalid dish')
    item_id=item.get('id');quantity=item.get('quantity')
    if type(item_id)!=int or item_id not in CATALOG or item_id in seen or type(quantity)!=int or not 1<=quantity<=99:raise ValueError('Please check your dishes and quantities')
    dish=CATALOG[item_id];seen.add(item_id);subtotal+=dish['price']*quantity
    validated.append({'id':item_id,'name':dish['name'],'price':dish['price'],'quantity':quantity})
   created=now_iso()
   payload={'id':'D'+uuid.uuid4().hex[:8].upper(),'type':'delivery','customer':clean,'items':validated,'subtotal':subtotal,'total':subtotal,'deliveryFee':None,'status':'received','paymentStatus':'not_collected','createdAt':created,'updatedAt':created,'events':[{'status':'received','at':created}]}
   with database() as db:
    db.execute('BEGIN IMMEDIATE')
    existing=db.execute('SELECT payload FROM delivery_orders WHERE request_id=?',(request,)).fetchone()
    if existing:
     saved=json.loads(existing[0])
     if saved['customer']!=clean or saved['items']!=validated:raise ValueError('This request changed. Please send it again')
     payload=saved
    else:db.execute('INSERT INTO delivery_orders(id,request_id,payload) VALUES(?,?,?)',(payload['id'],request,json.dumps(payload)))
   self.reply(200,{'id':payload['id'],'status':payload['status'],'subtotal':payload['subtotal'],'message':'Order request received. Restaurant confirmation is pending.'})
  except (ValueError,TypeError,KeyError,AttributeError) as error:self.reply(400,{'error':str(error) or 'Please check your order details'})
  except sqlite3.Error:self.reply(503,{'error':'Unable to save your order right now. Please try again.'})
 def admin_orders(self):
  if not self.is_local_admin():self.reply(403,{'error':'The local admin panel is available only on the restaurant computer at http://127.0.0.1:'+str(self.server.server_port)+'/admin.html'});return
  with database() as db:
   orders=[];today_orders=[]
   local_now=datetime.now(timezone(timedelta(hours=5,minutes=30)))
   start=local_now.replace(hour=0,minute=0,second=0,microsecond=0).astimezone(timezone.utc)
   end=start+timedelta(days=1)
   for source,kind in [('orders','dine_in'),('delivery_orders','delivery')]:
    for payload,created in db.execute(f'SELECT payload,created_at FROM {source} ORDER BY rowid DESC LIMIT 100'):
     value=json.loads(payload);value['type']=kind;value.setdefault('createdAt',created.replace(' ','T')+'Z');orders.append(value)
    for payload, in db.execute(f'SELECT payload FROM {source} WHERE datetime(created_at)>=datetime(?) AND datetime(created_at)<datetime(?)',(start.isoformat(),end.isoformat())):
     today_orders.append(json.loads(payload))
  orders.sort(key=lambda o:o['createdAt'],reverse=True)
  confirmed=[o for o in today_orders if o.get('status') in ('confirmed','preparing','out_for_delivery','delivered','served','completed')]
  summary={'date':local_now.date().isoformat(),'received':len(today_orders),'confirmedValue':round(sum(o.get('total',0) for o in confirmed),2),'completed':sum(o.get('status') in ('delivered','completed') for o in today_orders)}
  self.reply(200,{'orders':orders,'serverTime':now_iso(),'today':summary,'listLimitPerChannel':100})
 def admin_note(self):
  if not self.is_local_admin():self.reply(403,{'error':'Admin access requires the restaurant computer'});return
  try:
   data=self.read_json();kind=data.get('type');order_id=data.get('id');note=data.get('note')
   if kind not in ('delivery','dine_in') or not isinstance(order_id,str) or not re.fullmatch(r'D?[A-F0-9]{8}',order_id):raise ValueError('Invalid order')
   if not isinstance(note,str) or len(note)>1000:raise ValueError('Keep the staff note under 1,000 characters')
   source='delivery_orders' if kind=='delivery' else 'orders'
   with database() as db:
    db.execute('BEGIN IMMEDIATE')
    row=db.execute(f'SELECT payload,created_at FROM {source} WHERE id=?',(order_id,)).fetchone()
    if not row:self.reply(404,{'error':'Order not found'});return
    order=json.loads(row[0]);order.setdefault('createdAt',row[1].replace(' ','T')+'Z')
    order['internalNote']=note.strip();order['internalNoteUpdatedAt']=now_iso()
    db.execute(f'UPDATE {source} SET payload=? WHERE id=?',(json.dumps(order),order_id))
   self.reply(200,{'order':{**order,'type':kind}})
  except (ValueError,TypeError,KeyError,AttributeError) as error:self.reply(400,{'error':str(error)})
  except sqlite3.Error:self.reply(503,{'error':'Unable to save the note. Please try again.'})
 def admin_status(self):
  if not self.is_local_admin():self.reply(403,{'error':'Admin access requires the restaurant computer'});return
  try:
   data=self.read_json();kind=data.get('type');order_id=data.get('id');status=data.get('status')
   if kind not in ('delivery','dine_in') or not isinstance(order_id,str) or not re.fullmatch(r'D?[A-F0-9]{8}',order_id):raise ValueError('Invalid order')
   source='delivery_orders' if kind=='delivery' else 'orders'
   transitions={'received':['confirmed','rejected'],'confirmed':['preparing','rejected'],'preparing':['out_for_delivery' if kind=='delivery' else 'served'],'out_for_delivery':['delivered'],'served':['completed']}
   with database() as db:
    db.execute('BEGIN IMMEDIATE')
    row=db.execute(f'SELECT payload,created_at FROM {source} WHERE id=?',(order_id,)).fetchone()
    if not row:self.reply(404,{'error':'Order not found'});return
    order=json.loads(row[0]);order.setdefault('createdAt',row[1].replace(' ','T')+'Z');current=order.get('status','received')
    if status not in transitions.get(current,[]):raise ValueError('Order status changed. Refresh before taking this action')
    if kind=='delivery' and status=='confirmed':
     fee=data.get('deliveryFee')
     if type(fee) not in (int,float) or not 0<=fee<=2000 or round(fee,2)!=fee:raise ValueError('Enter a valid confirmed delivery charge')
     order['deliveryFee']=fee;order['total']=round(order['subtotal']+fee,2)
    order['status']=status;order['updatedAt']=now_iso();order.setdefault('events',[]).append({'status':status,'at':order['updatedAt']})
    db.execute(f'UPDATE {source} SET payload=? WHERE id=?',(json.dumps(order),order_id))
   self.reply(200,{'order':{**order,'type':kind}})
  except (ValueError,TypeError,KeyError,AttributeError) as error:self.reply(400,{'error':str(error)})
  except sqlite3.Error:self.reply(503,{'error':'Unable to update this order. Please try again.'})
 def end_headers(self):
  route=self.path.split('?')[0]
  self.send_header('Cache-Control','no-store' if route=='/' or route.endswith('.html') or route.startswith('/api/') else 'no-cache')
  super().end_headers()
 def do_GET(self):
  from urllib.parse import urlsplit,unquote,parse_qs
  parsed=urlsplit(self.path);route=unquote(parsed.path)
  if route=='/home.html':self.path='/index.html';route='/index.html'
  if route=='/api/admin/orders':self.admin_orders();return
  if route=='/admin.html' and not self.is_local_admin():self.reply(403,{'error':'Open the admin panel on the restaurant computer using http://127.0.0.1:'+str(self.server.server_port)+'/admin.html'});return
  if route in ('/','/index.html') and parse_qs(parsed.query).get('table'):
   self.path='/table-menu.html'+('?' + parsed.query if parsed.query else '');route='/table-menu.html'
  allowed={'/pages-runtime.js','/admin-preview.html','/','/index.html','/home.html','/table-menu.html','/delivery.html','/admin.html','/website.css','/website.js','/restaurant-config.js','/delivery.css','/delivery.js','/admin.css','/admin.js','/robots.txt','/order.html','/style.css','/order-styles.css','/app.js','/order.js','/menu-data.js','/premium.css','/orders.html','/customer-orders.js','/customer-orders.css','/readability.css','/menu-header.css'}
  if route not in allowed and not (route.startswith('/assets/') and '..' not in route and Path(route).suffix in {'.svg','.png','.webp','.jpg','.ttf','.woff2','.woff'}):
   self.send_error(404);return
  super().do_GET()
 def do_POST(self):
  if self.path=='/api/delivery/orders':self.delivery_order();return
  if self.path=='/api/admin/orders/status':self.admin_status();return
  if self.path=='/api/admin/orders/note':self.admin_note();return
  if self.path not in ('/api/orders','/api/coupons/validate'):self.send_error(404);return
  try:
   origin=self.headers.get('Origin')
   if origin and origin != 'http://'+self.headers.get('Host',''):raise ValueError('Invalid origin')
   size=int(self.headers.get('Content-Length','0'))
   if size<1 or size>12000:raise ValueError('Invalid request size')
   data=json.loads(self.rfile.read(size));table=str(data.get('table',''))
   if not re.fullmatch(r'[A-Za-z]?\d{1,3}',table):raise ValueError('Invalid table')
   items=data.get('items');notes=data.get('notes','')
   request=str(uuid.UUID(data.get('requestId',''))) if self.path=='/api/orders' else None
   if not isinstance(notes,str) or len(notes)>500:raise ValueError('Invalid note')
   if not isinstance(items,list) or not 1<=len(items)<=len(CATALOG):raise ValueError('Invalid items')
   total=0;seen=set();validated=[]
   for item in items:
    item_id=item.get('id');qty=item.get('quantity')
    if type(item_id)!=int or item_id not in CATALOG or item_id in seen or type(qty)!=int or not 1<=qty<=99:raise ValueError('Invalid dish or quantity')
    item_note=item.get('notes','')
    if not isinstance(item_note,str) or len(item_note)>300:raise ValueError('Invalid item note')
    seen.add(item_id);dish=CATALOG[item_id];total+=dish['price']*qty
    validated.append({'id':item_id,'name':dish['name'],'quantity':qty,'price':dish['price'],'notes':item_note})
   code=str(data.get('coupon','')).strip().upper()
   if len(code)>30:self.reply(400,{'error':'Please enter a valid coupon code.'});return
   rules=json.loads((ROOT/'coupons.json').read_text(encoding='utf-8')).get('coupons',[])
   quote=coupon_quote(total,code,rules)
   if 'error' in quote:self.reply(400,quote);return
   if self.path=='/api/coupons/validate':self.reply(200,quote);return
   payload={'id':uuid.uuid4().hex[:8].upper(),'table':table,'items':validated,'notes':notes,**quote,'status':'received'}
   with database() as db:
    existing=db.execute('SELECT payload FROM orders WHERE request_id=?',(request,)).fetchone()
    if existing:payload=json.loads(existing[0])
    else:db.execute('INSERT INTO orders(id,request_id,payload) VALUES(?,?,?)',(payload['id'],request,json.dumps(payload)))
   self.reply(200,payload)
  except (ValueError,TypeError,KeyError,AttributeError):self.reply(400,{'error':'Please check the selected dishes and try again.'})
 def reply(self,status,payload):
  body=json.dumps(payload).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
if __name__=='__main__':
 import os,argparse
 parser=argparse.ArgumentParser();parser.add_argument('--host',default='127.0.0.1');parser.add_argument('--port',type=int,default=8081);args=parser.parse_args()
 os.chdir(ROOT)
 ThreadingHTTPServer((args.host,args.port),Handler).serve_forever()
