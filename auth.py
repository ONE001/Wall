import tornado.auth
import tornado.web
import tornado.escape
import db

class Base():
    db = db.Mongo()

    def get_current_user(self):
        user_json = self.get_secure_cookie("user")
        if not user_json: return None
        user_json = tornado.escape.json_decode(user_json)

        user = self.db.get_user_by_email(user_json['email'])
        if user is None:
            self.db.add_user(user_json)

        return self.db.get_user_by_email(user_json['email'])

class BaseHandler(Base, tornado.web.RequestHandler):
    pass

class BaseSocketHandler(Base, tornado.websocket.WebSocketHandler):
    pass

class GoogleAuthHandler(BaseHandler, tornado.auth.GoogleMixin):
    @tornado.web.asynchronous
    def get(self):
        if self.get_argument("openid.mode", None):
            self.get_authenticated_user(self.async_callback(self._on_auth))
            return
        self.authenticate_redirect()

    def _on_auth(self, user):
        if not user:
            raise tornado.web.HTTPError(500, "Google auth failed")
        self.set_secure_cookie("user", tornado.escape.json_encode(user))
        self.redirect("/")

class LogoutHandler(BaseHandler):
    def get(self):
        self.clear_cookie("user")
        self.redirect(self.get_argument("next", "/"))

class AnonimousAuthHandler(BaseHandler):
    def get(self, path):
        username = "Guest"
        auth = self.db.get_user_by_name(username)

        if auth:
            self.set_current_user({ 'name' : auth['first_name'], 'email' : auth['email'] })

            if path is not None:
                return self.redirect('/' + path)

            return self.redirect("/")
        else:
            error_msg = u"?error=" + tornado.escape.url_escape("Login incorrect.")
            self.redirect(u"/login" + error_msg)

    def set_current_user(self, user):
        if user:
            self.set_secure_cookie("user", tornado.escape.json_encode(user))
        else:
            self.clear_cookie("user")
