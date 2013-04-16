define(function () {
    function UserWebSocket(url, init_callback) {
        if (url === undefined) {
            throw new Error("The parameter 'url' must be specified!");
        }

        var _instance;

        UserWebSocket = function () {
            return _instance;
        };
        UserWebSocket.prototype = this;
        _instance = new UserWebSocket();
        _instance.constructor = UserWebSocket;

        /* Индикатор состояния соединения. */
        var _oflg = false;

        /* Объект, позволяющий организовать список функций обратного вызова в виде
           очереди (FIFO). Это необходимо для того, чтобы четко сопоставлять
           каждому запросу соответствующий ему ответ, который, в свою очередь,
           будет использоваться в качестве входного параметра функции обратного
           вызова. */
        var _queue = function() {
            var _callbacks = [];
            return {
                add: function(unit) {
                    if (unit && unit.constructor === Function)
                        return _callbacks.push(unit);
                    else
                        return false;
                },
                isEmpty: function() {
                    return _callbacks.length === 0;
                },
                next: function() {
                    return _callbacks.shift();
                }
            }
        }();

        /* Максимальное количество попыток соединений. */
        var _connection_limit = 5;

        /* Номер попытки повторного соединения. */
        var n = 0;

        // метод открывает соединения и навешивает необходимые обработчики
        // в случае обрыва соединения пытается переподключиться _connection_limit раз
        function connect()
        {
            var __socket = (function() {
                if ('WebSocket' in window)
                    return new WebSocket(url);
                else
                    return new MozWebSocket(url);
            }());

            /* Переопределение стандартных обработчиков событий объекта WebSocket:
               - соединение с сервером установлено;
               - соединение с сервером разорвано;
               - клиент получил от сервера, по установленному ранее каналу связи,
               сообщение. */
            __socket.onopen = function() {
                console.info("opened connection");
                _oflg = true;
                n = 0;

                // инициализация всей остальной системы, после открытия соединения
                if (init_callback && typeof init_callback === "function") {
                    init_callback();
                }
            };

            __socket.onclose = function() {
                console.info("closed connection");
                _oflg = false;

                if (n === _connection_limit) {
                    throw new Error("Connection failed!");
                }

                _socket = connect();
                ++n;
            };

            __socket.onmessage = function(event) {
                var data = JSON.parse(event.data);

                switch (data.op) {
                case 'get_users':
                    WALL.wall.update_user_list(JSON.parse(data.users));
                    break;
                case 'set_background':
                    WALL.wall.canvas.style['background'] = data.color;
                    break;
                case 'line':
                    WALL.wall.put_line(data.line, data.user_id);
                    break;
                case 'clear_wall':
                    WALL.Controller.init();
                    break;
                default :
                    break;
                }

                if (!_queue.isEmpty()) {
                    var current = _queue.next();
                    return current(event);
                }
            };

            return __socket;
        };

        var _socket = connect();

        /* Публичный метод, в задачи которого входит:
           - отправка данных на сервер по установленному ранее каналу связи;
           - сохранение функции обратного вызова в очереди. */
        this.send = function(data, callback) {
            if (typeof data !== "object") {
                throw new Error("The parameter 'data' must be Object!");
            }

            data = JSON.stringify(data);

            if (!_oflg) {
                throw new Error("Connection wasn't established")
            }

            /* Сохраняем функцию обратного вызова в очереди. */
            _queue.add(callback);
            return _socket.send(data);
        };
    }

    return UserWebSocket;
});
