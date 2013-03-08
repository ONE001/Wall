import pymongo
import tornado.web
import datetime

from bson.objectid import ObjectId

class Mongo():
    def __init__(self):
        self.__db = pymongo.Connection("mongodb://localhost", safe=True).wall

#========================================================================

    def get_user_by_email(self, email):
        return self.__db.users.find_one({ 'email' : email })

#========================================================================

    def get_user_by_name(self, name):
        return self.__db.users.find_one({ 'name' : name })

#========================================================================

    def get_user_by_id(self, id):
        return self.__db.users.find_one({ '_id' : ObjectId(str(id)) })

#========================================================================

    def add_user(self, user):
        return self.__db.users.insert(user)

#========================================================================

    def add_wall(self, args = dict()):
        if not args:
            raise tornado.web.HTTPError(500, "args can not be empty")

        now = datetime.datetime.now()
        args['last_connection'] = now
        args['created'] = now
        args['background'] = '#FFFFFF'

        return self.__db.walls.insert(args)

#========================================================================

    def get_wall(self, id):
        return self.__db.walls.find_one({ '_id' : ObjectId(str(id)) })

#========================================================================

    def update_wall_last_connection(self, id):
        return self.__db.walls.update({ '_id' : ObjectId(str(id)) }, {'$set' : { 'last_connection' : datetime.datetime.now() }})

#========================================================================

    def get_opened_walls(self):
        return self.__db.walls.find({ '$or' : [{ 'hidden' : { '$exists' : False }}, {'hidden' : 0 }] })

#========================================================================

    def init_current_wall_for_user(self, user_id, wall_id):
        return self.__db.current_walls.update({ 'user_id' : ObjectId(user_id) }, {'$set' : { 'user_id' : ObjectId(str(user_id)), 'wall_id' : ObjectId(str(wall_id)) } }, True )

#========================================================================

    def get_current_wall_for_user(self, user_id):
        return self.__db.current_walls.find_one({ 'user_id' : ObjectId(user_id) }, { 'wall_id' : 1, '_id' : 0 })['wall_id']

#========================================================================

    def set_background(self, wall_id, color):
        self.__db.walls.update({ '_id' : ObjectId(str(wall_id)) }, { '$set' : { 'background' : color } })

#========================================================================

    def get_background(self, wall_id):
        return self.__db.walls.find_one({ '_id' : ObjectId(str(wall_id)) }, {'background' : 1, '_id' : 0})['background']

#========================================================================

    def add_coordinates(self, wall_id, points, data, user_id):
        self.__db.lines.update(
            { 'wall_id' : ObjectId(str(wall_id)) },
            {'$push' : { 'line' : {'points' : points, 'data' : data, 'user_id' : user_id } } },
            True
        )

#========================================================================

    def get_lines(self, wall_id):
        return self.__db.lines.find_one({ 'wall_id' : ObjectId(str(wall_id)) }, { '_id' : 0, 'line' : 1 })

#========================================================================

    def clear_wall(self, wall_id):
        self.__db.lines.remove({ 'wall_id' : ObjectId(str(wall_id)) })
