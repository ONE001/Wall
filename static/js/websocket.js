define(function () {
    function UserWebSocket(url) {
        if (url === undefined)
            throw new Error("The parameter 'url' must be specified!");

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

        var _socket = function() {
            if ('WebSocket' in window)
                return new WebSocket(url);
            else
                return new MozWebSocket(url);
        }();

        /* Поля, используемые для экспоненциального увеличение значения таймера
           повторного соединения. */
        /* Начальное значение таймера повторного соединения. */
        var _time_0 = 1000, // ms
        /* Темп роста. */
        _r = 0.25,
        /* Максимальное количество попыток соединений. */
        _connection_limit = 15;

        /* Переопределение стандартных обработчиков событий объекта WebSocket:
           - соединение с сервером установлено;
           - соединение с сервером разорвано;
           - клиент получил от сервера, по установленному ранее каналу связи,
           сообщение. */

        _socket.onopen = function() {
            _oflg = true;
        };

        _socket.onclose = function() {
            _oflg = false;
        };

        _socket.onmessage = function(event) {
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

        /* Публичный метод, в задачи которого входит:
           - отправка данных на сервер по установленному ранее каналу связи;
           - сохранение функции обратного вызова в очереди. */
        this.send = function(data, callback)
        {
            if (data.constructor !== Object)
                throw new Error("The parameter 'data' must be an Object!");

            data = JSON.stringify(data);

            /* Экспоненциальное увеличение значения таймера повторного
               соединения. */

            /* Номер попытки повторного соединения. */
            var n = 0,
            /* Значение таймера повторного соединения во время n-го подключения. */
            time_n = 0, // ms
            interval = setInterval(function() {
                if (_oflg) {
                    clearInterval(interval);

                    /* Сохраняем функцию обратного вызова в очереди. */
                    _queue.add(callback);
                    return _socket.send(data);
                }

                if (n === _connection_limit) {
                    clearInterval(interval);
                    throw new Error("Connection failed!");
                }

                time_n = _time_0 * Math.exp(_r * n);
                ++n;
            }, time_n);
        };

        return _instance;
    }

    return UserWebSocket;
});
