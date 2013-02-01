define(function() {
    function User(user)
    {
        if (!(this instanceof User)) {
            return new User(user);
        }

        (function() {
            var i;
            for (i in user) {
                if (!user.hasOwnProperty(i)) {
                    continue;
                }

                this[i] = user[i];
            }
        }).call(this);
    }

    // ======================================
    User.fn = User.prototype;
    var users = {};

    function each(obj, handler)
    {
        if (arguments.length !== 2) {
            throw new Error("necessary 2 arguments");
        }

        var i;

        for (i in obj) {
            if (!obj.hasOwnProperty(i)) {
                continue;
            }

            handler(obj[i]);
        }
    }

    User.add = function(key, value) {
        users[key] = value;
    };

    User.remove = function(id) {
        return delete users[id];
    };

    User.all = function() {
        return users;
    };

    User.array_all = function() {
        var i, result = [];

        each(users, function(user) {
            result.push(user);
        });

        return result;
    }

    User.find_by = function(args) {
        var i, result = [];

        if (typeof args !== "object" || args.constructor !== Object) {
            throw new Error("arg have to be an `object`");
        }

        each(users, function(user) {
            var j;
            for (j in args) {
                if (!args.hasOwnProperty(j)) {
                    continue;
                }

                if (user[j] !== args[j]) {
                    return null;
                }
            }
            result.push(user);
        });

        return result;
    };

    User.find = function(id) {
        var result = false;

        each(users, function(user) {
            if (user._id === id) {
                result = user;
            }
        });

        return result;
    };

    User.drop = function() {
        users = {};
        return users;
    };

    User.fn.save = function() {
        User.add(this._id, this);
    };

    User.fn.destroy = function() {
        User.remove(this._id);
    };
    // ======================================

    return User;
});
