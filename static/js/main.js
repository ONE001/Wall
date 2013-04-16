define(["websocket", "wall", "user", "controller"], function(websocket, wall, user, Controller) {
    // ==============================
    WALL.namespace("WALL.wall");
    WALL.namespace("WALL.websocket");
    WALL.namespace("WALL.User");
    WALL.namespace("WALL.Controller");
    // ==================

    // ==============================
    WALL.wall = new wall(document.querySelector("#cnvs"), document.querySelector("#customize_panel"), document.querySelector("#user_list"));
    WALL.websocket = new websocket("ws://" + location.host + "/socket", function() {
        // ==============================
        WALL.User = user;
        WALL.Controller = new Controller();
        // ==================
    });
    // ==================
});

var WALL = WALL || {};

WALL.namespace = function(ns_string) {
    var parts = ns_string.split('.'),
        parent = WALL,
        i = 0;

    if (parts[0] === "WALL") {
        parts = parts.slice(1);
    }

    for (; i < parts.length; i += 1) {
        if (typeof parent[parts[i]] === "undefined") {
            parent[parts[i]] = {};
        }
        parent = parent[parts[i]];
    }

    return parent;
};
