"""Exercise public order entry and private admin against a disposable database."""
import json,os,sys,tempfile,threading,uuid
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
with tempfile.TemporaryDirectory(prefix='bedesi-public-qa-') as temporary:
 os.environ['BEDESI_DB']=str(Path(temporary)/'qa.sqlite3')
 import server,public_api
 servers=[server.ThreadingHTTPServer(('127.0.0.1',0),handler) for handler in [public_api.PublicOrderHandler,server.Handler]]
 for http in servers:threading.Thread(target=http.serve_forever,daemon=True).start()
 def call(http,path,data=None,origin=None,method=None):
  headers={'Content-Type':'application/json'}
  if origin:headers['Origin']=origin
  req=Request(f'http://127.0.0.1:{http.server_port}'+path,data=json.dumps(data).encode() if data is not None else None,headers=headers,method=method)
  try:
   with urlopen(req,timeout=8) as r:return r.status,r.headers,r.read()
  except HTTPError as e:return e.code,e.headers,e.read()
 public,admin=servers;origin=public_api.ORIGIN
 try:
  assert call(public,'/api/health')[0]==200
  for path in ['/api/admin/orders','/admin.html','/orders.sqlite3','/server.py','/api/%61dmin/orders']:
   assert call(public,path)[0]==404
  assert call(public,'/orders.sqlite3',method='HEAD')[0]==404
  assert call(public,'/api/admin/orders/note',{},origin)[0]==404
  assert call(public,'/api/orders',{},'https://unrelated.example')[0]==403
  assert call(public,'/api/orders',{})[0]==403
  assert call(public,'/api/orders',origin=origin,method='OPTIONS')[0]==204
  payload={'requestId':str(uuid.uuid4()),'table':'Q99','items':[{'id':1301715153,'quantity':1}],'notes':'Disposable integration test','coupon':''}
  code,headers,body=call(public,'/api/orders',payload,origin)
  assert code==200 and headers['Access-Control-Allow-Origin']==origin
  result=json.loads(body);assert result['total']==50
  assert json.loads(call(public,'/api/orders',payload,origin)[2])['id']==result['id']
  delivery={'requestId':str(uuid.uuid4()),'items':[{'id':1301715153,'quantity':2}],'customer':{'name':'Public API QA','phone':'9999999999','address':'Disposable QA address only','city':'Kokrajhar','pincode':'111111','notes':''}}
  assert call(public,'/api/delivery/orders',delivery,origin)[0]==200
  orders=json.loads(call(admin,'/api/admin/orders')[2])['orders']
  assert len(orders)==2 and any(o['id']==result['id'] for o in orders)
  assert all(o['status']=='received' for o in orders)
  print('PASS: public CORS, table/delivery order persistence, deduplication, private admin visibility and blocked admin/database routes.')
 finally:
  for http in servers:http.shutdown();http.server_close()
