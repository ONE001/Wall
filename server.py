#!/usr/bin/env python
import tornado.ioloop
import tornado.web
import os.path

#====================socket=============================#
import logging
import tornado.websocket
import tornado.escape
#====================/socket=============================#

from jinja2 import Environment, FileSystemLoader
from tornado.options import define, options

import filters

import auth
import db

define("port", default=8888, help="run on the given port", type=int)

#========================================================================

class Application(tornado.web.Application):
    db = db.Mongo()

    def __init__(self):
        handlers = [
            (r"/", MainHandler),
            (r"/socket", SocketHandler),
            (r"/create_wall/?", CreateWallHandler),
            (r"/wall_list/?", WallListHandler),
            (r"/wall/([\w]+)/?", WallHandler),

            (r"/login/?", LoginHandler),
            (r"/google_login/?", auth.GoogleAuthHandler),
            (r"/logout/?", auth.LogoutHandler),
        ]
        settings = dict(
            cookie_secret="43oETzKXQAGaYdkL5gEmGeJJFuYh7EQnp2XdTP1o/Vo=",
            template_path=os.path.join(os.path.dirname(__file__), "templates"),
            static_path=os.path.join(os.path.dirname(__file__), "static"),
            xsrf_cookies=True,
            autoescape=None,
            login_url="/login",
        )
        tornado.web.Application.__init__(self, handlers, **settings)

#========================================================================

class MainHandler(auth.BaseHandler):
    @tornado.web.authenticated
    def get(self):
        self.get_current_user()
        env = Environment(loader=FileSystemLoader(os.path.join(os.path.dirname(__file__), "templates")))
        template = env.get_template('index.htm')
        self.write(template.render())

#========================================================================

class WallHandler(auth.BaseHandler):
    @tornado.web.authenticated
    def get(self, id):
        # wall = Application.db.get_wall(id)

        # if wall is None:
        #     raise tornado.web.HTTPError(500, "wall wasn't found")

        # update last connection for wall
        Application.db.update_wall_last_connection(id)

        # init current wall for current user
        if self.get_current_user():
            Application.db.init_current_wall_for_user(self.get_current_user()['_id'], id)

        env = Environment(loader=FileSystemLoader(os.path.join(os.path.dirname(__file__), "templates")))
        template = env.get_template('wall.htm')
        self.write(template.render(wall = SocketHandler.cache))

#========================================================================

class LoginHandler(auth.BaseHandler):
    def get(self):
        env = Environment(loader=FileSystemLoader(os.path.join(os.path.dirname(__file__), "templates")))
        template = env.get_template('login.htm')
        self.write(template.render())

#========================================================================

class WallListHandler(auth.BaseHandler):
    @tornado.web.authenticated
    def get(self):
        env = Environment(loader=FileSystemLoader(os.path.join(os.path.dirname(__file__), "templates")))
        template = env.get_template('wall_list.htm')

        walls = Application.db.get_opened_walls()
        format_walls = []

        for wall in walls:
            wall['author'] = Application.db.get_user_by_id(wall['author_id'])
            format_walls.append(wall)

        self.write(template.render({ 'walls' : format_walls }))

#========================================================================
class CreateWallHandler(auth.BaseHandler):
    @tornado.web.authenticated
    def get(self):
        env = Environment(loader=FileSystemLoader(os.path.join(os.path.dirname(__file__), "templates")))
        template = env.get_template('create_wall.htm')
        self.write(template.render({ 'xsrf_form_html' : self.xsrf_form_html }))

    @tornado.web.authenticated
    def post(self):
        name = self.get_argument("wall_name", default=None, strip=True)
        password = self.get_argument("wall_password", default='')
        hidden = self.get_argument("wall_hidden", default=0)

        if hidden != 0:
            hidden = 1

        if name is None:
            name = ''
            env = Environment(loader=FileSystemLoader(os.path.join(os.path.dirname(__file__), "templates")))
            template = env.get_template('create_wall.htm')
            self.write(template.render({ 'xsrf_form_html' : self.xsrf_form_html, 'name' : name, 'password' : password, 'hidden' : hidden }))
        else:
            wall = dict(name=name, author_id=self.get_current_user()['_id'], hidden=hidden)

            if password != '':
                wall['password']=password

            self.redirect("/wall/%s/?" % (Application.db.add_wall(wall)))

#========================================================================

class SocketHandler(auth.BaseSocketHandler):
    waiters = dict()
    cache = []
    cache_size = 200

#============================================

    def open(self):
        current_user = self.get_current_user()
        wall_id = Application.db.get_current_wall_for_user(current_user['_id'])
        if wall_id not in SocketHandler.waiters:
            SocketHandler.waiters[wall_id] = []

        current_user['_id'] = str(current_user['_id'])

        SocketHandler.waiters[wall_id].append({'that' : self, 'user' : current_user })

#============================================

    def on_close(self):
        current_user = self.get_current_user()
        wall_id = Application.db.get_current_wall_for_user(current_user['_id'])
        if wall_id not in SocketHandler.waiters:
            SocketHandler.waiters[wall_id] = []

        current_user['_id'] = str(current_user['_id'])

        SocketHandler.waiters[wall_id].remove({ 'that' : self, 'user' : current_user })

#============================================

    @classmethod
    def update_cache(cls, wall):
        cls.cache.append(wall)
        if len(cls.cache) > cls.cache_size:
            cls.cache = cls.cache[-cls.cache_size:]

#============================================

    @classmethod
    def send_updates(cls, message, waiters, this=False):
        if (type(waiters) == list):
            logging.info("sending message to %d waiters", len(waiters))
            for waiter in waiters:
                try:
                    if waiter['that'] != this:
                        waiter['that'].write_message(message)
                except:
                    logging.error("Error sending message", exc_info=True)
        else:
            waiters.write_message(message)

#============================================

    def on_message(self, message):
        logging.info("got message %r", message)
        parsed = tornado.escape.json_decode(message)

        wall_id = Application.db.get_current_wall_for_user(self.get_current_user()['_id'])
        waiters = self.waiters[wall_id]

        if parsed['op'] == 'get_users':
            users = []

            for waiter in waiters:
                users.append(waiter['user'])

            SocketHandler.send_updates({ 'op' : parsed['op'], 'users' :  tornado.escape.json_encode(users) }, waiters)

        elif parsed['op'] == 'set_background':
            Application.db.set_background(wall_id, parsed['color'])
            SocketHandler.send_updates({ 'op' : parsed['op'], 'color' : parsed['color'] }, waiters)

        elif parsed['op'] == 'get_lines':
            #lines = Application.db.get_lines(wall_id)
            new_lines = { 'line' : [] }

            #if lines is not None:
            #    for i in lines['line']:
            #        i['user_id'] = str(i['user_id'])
            #        new_lines['line'].append(i)

            SocketHandler.send_updates({ 'op' : parsed['op'], 'background' : Application.db.get_background(wall_id), 'lines' : new_lines }, self)

        elif parsed['op'] == 'line':
            #Application.db.add_coordinates(wall_id, parsed['points'], parsed['data'], self.get_current_user()['_id'])
            SocketHandler.send_updates({ 'op' : parsed['op'], 'line' : { 'points' : parsed['points'], 'data' : parsed['data'] }, 'user_id' : str(self.get_current_user()['_id']) }, waiters, self)

        elif parsed['op'] == 'clear_wall' :
            Application.db.clear_wall(wall_id)
            SocketHandler.send_updates({ 'op' : parsed['op'] }, waiters)

        #SocketHandler.update_cache(parsed)
        #SocketHandler.send_updates(parsed, waiters)

#============================================

def main():
    options.parse_command_line()
    app = Application()
    app.listen(options.port)
    tornado.ioloop.IOLoop.instance().start()

if __name__ == "__main__":
    main()
