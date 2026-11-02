"""Order-only public listener. Never tunnel the private admin server."""
from http.server import ThreadingHTTPServer
from server import Handler

ORIGIN='https://workbinodshaw-design.github.io'
ROUTES={'/api/orders','/api/coupons/validate','/api/delivery/orders'}

class PublicOrderHandler(Handler):
 def is_local_admin(self):return False
 def origin_allowed(self,origin):return origin==ORIGIN
 def end_headers(self):
  if self.headers.get('Origin')==ORIGIN:
   self.send_header('Access-Control-Allow-Origin',ORIGIN)
   self.send_header('Access-Control-Allow-Methods','POST, GET, OPTIONS')
   self.send_header('Access-Control-Allow-Headers','Content-Type')
   self.send_header('Access-Control-Max-Age','600')
   self.send_header('Vary','Origin')
  super().end_headers()
 def do_OPTIONS(self):
  if self.path not in ROUTES or self.headers.get('Origin')!=ORIGIN:self.reply(403,{'error':'Not allowed'});return
  self.send_response(204);self.end_headers()
 def do_GET(self):
  if self.path=='/api/health':self.reply(200,{'ok':True,'service':'Bedesi orders'});return
  self.reply(404,{'error':'Not found'})
 def do_HEAD(self):self.send_response(404);self.end_headers()
 def do_POST(self):
  if self.path not in ROUTES:self.reply(404,{'error':'Not found'});return
  if self.headers.get('Origin')!=ORIGIN:self.reply(403,{'error':'Not allowed'});return
  super().do_POST()

if __name__=='__main__':
 import argparse
 parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8086);args=parser.parse_args()
 ThreadingHTTPServer(('127.0.0.1',args.port),PublicOrderHandler).serve_forever()
