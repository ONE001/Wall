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

class FacebookAuthHandler(BaseHandler, tornado.auth.FacebookGraphMixin):
    @tornado.web.asynchronous
    def get(self):
        my_url = (self.request.protocol + "://" + self.request.host +
                  "/login?next=" +
                  tornado.escape.url_escape(self.get_argument("next", "/")))

        if self.get_argument("code", False):
            self.get_authenticated_user(
                redirect_uri=my_url,
                client_id=self.settings["facebook_api_key"],
                client_secret=self.settings["facebook_secret"],
                code=self.get_argument("code"),
                callback=self._on_auth)
            return

        self.authorize_redirect(redirect_uri=my_url,
                                client_id=self.settings["facebook_api_key"],
                                extra_params={"scope": "read_stream"})

    def _on_auth(self, user):
        #if not user:
        #    raise tornado.web.HTTPError(500, "Facebook auth failed")
        self.facebook_request("/me/home", self._on_stream,
                              access_token=self.current_user["access_token"])

        self.set_secure_cookie("user", tornado.escape.json_encode(user))

    def _on_stream(self, stream):
        if stream is None:
            # Session may have expired
            self.redirect("/login")
            return

        #self.redirect(self.get_argument("next", "/"))

class LogoutHandler(BaseHandler):
    def get(self):
        self.clear_cookie("user")
        self.redirect(self.get_argument("next", "/"))
