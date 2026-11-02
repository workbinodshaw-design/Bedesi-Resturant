"""Isolated API regression checks; --serve retains a disposable browser-QA server."""
import importlib.util,json,os,sqlite3,sys,tempfile,threading,uuid
from contextlib import closing
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError

ROOT=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='bedesi-qa-') as temporary:
 os.environ['BEDESI_DB']=str(Path(temporary)/'qa.sqlite3')
 spec=importlib.util.spec_from_file_location('bedesi_qa',ROOT/'server.py')
 app=importlib.util.module_from_spec(spec);spec.loader.exec_module(app)
 class QuietHandler(app.Handler):
  def log_message(self,*args):pass
 os.chdir(ROOT)
 http=app.ThreadingHTTPServer(('127.0.0.1',8085 if '--serve' in sys.argv else 0),QuietHandler)
 threading.Thread(target=http.serve_forever,daemon=True).start()
 base=f'http://127.0.0.1:{http.server_port}'
 def call(path,data=None,origin=None):
  headers={'Content-Type':'application/json'}
  if origin:headers['Origin']=origin
  req=Request(base+path,data=json.dumps(data).encode() if data is not None else None,headers=headers)
  try:
   with urlopen(req,timeout=8) as response:
    body=response.read();return response.status,json.loads(body) if 'application/json' in response.headers.get('Content-Type','') else body.decode()
  except HTTPError as error:
   body=error.read()
   try:return error.code,json.loads(body)
   except:return error.code,body.decode()
 try:
  assert 'A little desi.' in call('/')[1]
  assert 'Bedesi table menu' in call('/?table=07')[1]
  assert 'Bedesi table menu' in call('/index.html?table=07')[1]
  assert call('/orders.sqlite3')[0]==404
  customer={'name':'API QA Customer','phone':'9999999999','address':'Test address, isolated QA only','city':'Kokrajhar','pincode':'111111','notes':'Test fixture. Not a real order.'}
  dish=next(d for d in app.CATALOG.values() if d['name']=='Masala Tea')
  payload={'requestId':str(uuid.uuid4()),'customer':customer,'items':[{'id':dish['id'],'quantity':2,'price':1}],'total':1}
  status,result=call('/api/delivery/orders',payload);assert status==200,(status,result)
  assert result['subtotal']==dish['price']*2
  assert call('/api/delivery/orders',payload)[1]['id']==result['id']
  for change in [{'phone':'123'},{'pincode':'0'},{'address':'short'}]:
   bad={**payload,'requestId':str(uuid.uuid4()),'customer':{**customer,**change}}
   assert call('/api/delivery/orders',bad)[0]==400
  assert call('/api/delivery/orders',{**payload,'items':[{'id':dish['id'],'quantity':True}]})[0]==400
  assert call('/api/delivery/orders',{**payload,'customer':{**customer,'name':'Changed'}})[0]==400
  assert call('/api/delivery/orders',payload,'https://unrelated.example')[0]==400
  orders=call('/api/admin/orders')[1]['orders'];assert len(orders)==1 and orders[0]['customer']==customer
  transition={'type':'delivery','id':result['id']}
  assert call('/api/admin/orders/status',{**transition,'status':'delivered'})[0]==400
  assert call('/api/admin/orders/status',{**transition,'status':'confirmed','deliveryFee':-1})[0]==400
  accepted=call('/api/admin/orders/status',{**transition,'status':'confirmed','deliveryFee':30})
  assert accepted[0]==200 and accepted[1]['order']['total']==dish['price']*2+30
  for state in ['preparing','out_for_delivery','delivered']:
   assert call('/api/admin/orders/status',{**transition,'status':state})[0]==200
  assert call('/api/admin/orders/status',{**transition,'status':'rejected'})[0]==400
  table={'requestId':str(uuid.uuid4()),'table':'07','items':[{'id':dish['id'],'quantity':1}],'notes':'Isolated table-menu regression test','coupon':''}
  assert call('/api/orders',table)[0]==200
  overview=call('/api/admin/orders')[1]
  assert len(overview['orders'])==2
  assert overview['today']['received']==2 and overview['today']['completed']==1
  assert overview['today']['confirmedValue']==dish['price']*2+30
  note={'type':'delivery','id':result['id'],'note':'Kitchen QA note <plain text>'}
  assert call('/api/admin/orders/note',note)[0]==200
  assert call('/api/admin/orders/note',{**note,'note':'x'*1001})[0]==400
  assert call('/api/admin/orders/note',note,'https://unrelated.example')[0]==400
  stored=next(o for o in call('/api/admin/orders')[1]['orders'] if o['id']==result['id'])
  assert stored['internalNote']==note['note'] and stored['status']=='delivered'
  with closing(sqlite3.connect(app.DB)) as db:
   assert db.execute('SELECT COUNT(*) FROM delivery_orders').fetchone()[0]==1
   saved=json.loads(db.execute('SELECT payload FROM delivery_orders').fetchone()[0])
   assert saved['status']=='delivered' and len(saved['events'])==5
  print('PASS: routing, server prices, delivery validation, retry deduplication, origin checks, admin queue, status transitions, persistence and existing table-order API.',flush=True)
  if '--serve' in sys.argv:
   # Explicit QA fixtures for date filtering and waiting-time display.
   old=app.datetime.now(app.timezone.utc)-app.timedelta(days=1)
   fixture={'id':'AA110001','table':'99','items':[{'id':dish['id'],'name':dish['name'],'quantity':1,'price':dish['price']}],'subtotal':dish['price'],'total':dish['price'],'status':'completed','createdAt':old.isoformat(),'notes':'Yesterday fixture in disposable QA database'}
   with app.database() as db:
    db.execute('INSERT INTO orders(id,request_id,payload,created_at) VALUES(?,?,?,?)',(fixture['id'],str(uuid.uuid4()),json.dumps(fixture),old.strftime('%Y-%m-%d %H:%M:%S')))
    waiting=app.datetime.now(app.timezone.utc)-app.timedelta(minutes=45)
    table_row=db.execute('SELECT id,payload FROM orders WHERE id!=?',(fixture['id'],)).fetchone()
    table_payload=json.loads(table_row[1]);table_payload['createdAt']=waiting.isoformat()
    db.execute('UPDATE orders SET payload=?,created_at=? WHERE id=?',(json.dumps(table_payload),waiting.strftime('%Y-%m-%d %H:%M:%S'),table_row[0]))
   print('Disposable browser-QA server: '+base,flush=True)
   threading.Event().wait()
 finally:
  http.shutdown();http.server_close()
