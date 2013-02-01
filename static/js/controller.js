define(function() {
    return function() {
        var points = new Array(10), // массив объектов точек
            pointer,                // указатель на объекта в массиве
            action,                 // action - нажата (true) или отпущена (false) кнопка мыши
            wall,
            socket,
            that;

        this.init = function() {
            wall = WALL.wall;
            socket = WALL.websocket;

            // для начала инициализации очищаем холст (на случай если пользователь нажал на кнопку обновить)
            clear();

            WALL.User.drop();

            // инициализация...
            socket.send({ 'op' : 'get_users' }, function() {
                socket.send({ 'op' : 'get_lines' }, function(event) {
                    var data = JSON.parse(event.data),
                    i;
                    set_color(data.background);

                    if (data.lines) {
                        for (i in data.lines.line) {
                            wall.put_line(data.lines.line[i], data.lines.line[i]['user_id']);
                        }
                    }
                });
            });
        };

        /**
         * Метод очищает холст и после очистки вызывает callback функцию
         */
        var clear = function(handler) {
            // Сохраняем текущую матрицу трансформации
            wall.ctx.save();
            // Используем идентичную матрицу трансформации на время очистки
            wall.ctx.setTransform(1, 0, 0, 1, 0, 0);
            wall.ctx.clearRect(0, 0, wall.canvas.width, wall.canvas.height);
            // Возобновляем матрицу трансформации
            wall.ctx.restore();

            if (typeof handler === "function") {
                return handler();
            }
        };

        /**
         * метод устанавливает фон холста
         */
        var set_color = function(color, handler) {
            wall.canvas.style['background'] = color;

            if (typeof handler === "function") {
                return handler();
            }
        };

        /**
         * Метод устанавливает цвет линии
         */
        var set_line_color = function(color, handler) {
            wall.ctx.strokeStyle = color;

            if (typeof handler === "function") {
                return handler();
            }
        };

        /**
         * Метод устанавливает толщину пера
         */
        var set_width = function(width, handler) {
            wall.ctx.lineWidth = width;

            if (typeof handler === "function") {
                return handler();
            }
        };

        /**
         * Метод устанавливает прозрачность пера
         */
        var set_opacity = function(opacity, handler) {
            wall.ctx.globalAlpha = opacity;

            if (typeof handler === "function") {
                return handler();
            }
        };

        //============================================================================
        this.init();
        //============================================================================

        wall.canvas.addEventListener("mousedown", function(e) {
            action = true;
            points[0] = {
                left : e.pageX - wall.first_coordinates.left,
                top : e.pageY - wall.first_coordinates.top
            };
            pointer = 0;
        });

        document.addEventListener("mouseup",function(e) {
            points = new Array(20);
            action = false;
            socket.send({ 'op' : 'line', 'points' : wall.get_points(), 'data' : wall.get_data() }, function() {
                wall.clear_points();
            });
        });

        window.addEventListener("resize", function(e) {
            wall.init();
        });

        wall.canvas.addEventListener('mousemove', function(e) {
            if (action) {
                var nextpoint = pointer + 1,
                    startLineTo  = e.pageX - wall.first_coordinates.left,
                    finishLineTo = e.pageY - wall.first_coordinates.top;

                if (nextpoint > 19) {
                    socket.send({ 'op' : 'line', 'points' : wall.get_points(), 'data' : wall.get_data() }, function() {
                        wall.clear_points();
                    });
                    nextpoint = 0;
                }

                if (wall.feather === 0 || wall.feather === 1) {
                    // рисуем линию по точкам

                    wall.draw_point(
                        [points[pointer].left, points[pointer].top],
                        [startLineTo, finishLineTo]
                    );
                }

                if (wall.feather === 0 && points[nextpoint]) {
                    var startMoveTo = points[nextpoint].left + Math.round(Math.random()),
                    finishMoveTo = points[nextpoint].top + Math.round(Math.random());

                    // рисуем линию по точкам
                    wall.draw_point(
                        [startMoveTo, finishMoveTo],
                        [e.pageX - wall.first_coordinates.left, e.pageY - wall.first_coordinates.top]
                    );
                } else if (wall.feather === 2) {
                    // удаляем линии по точкам
                    wall.clear_point(
                        [points[pointer].left, points[pointer].top],
                        [startLineTo, finishLineTo]
                    );
                }

                pointer = nextpoint;
                points[pointer] = {
                    left : e.pageX - wall.first_coordinates.left,
                    top : e.pageY - wall.first_coordinates.top
                };
            }
        });

        // меняем фон канваса
        wall.customize_panel.addEventAt("background", "change", function(e) {
            var color = e.target.value;

            set_color(color, function() {
                socket.send({ 'op' : 'set_background', 'color' : color });
            });
        });

        // Меняем цвет линии
        wall.customize_panel.addEventAt("stroke_style", "change", function(e) {
            var color = e.target.value;

            set_line_color(color, function() {
                // TODO: посылать всем участникам данной сессии обновленный холст
            });
        });

        // очистка канваса
        wall.customize_panel.addEventAt("clear", "click", function() {
            clear(function() {
                socket.send({ "op" : "clear_wall" });
            });
        });

        // обновление холста
        wall.customize_panel.addEventAt("update", "click", function() {
            return that.init();
        });

        // смена пера на ластик
        wall.customize_panel.addEventAt("eraser", "click", function() {
            wall.set_feather(2);
        });

        // смена пера на фломастер
        wall.customize_panel.addEventAt("felt_pen", "click", function() {
            wall.set_feather(1);
        });

        // смена пера на карандаш
        wall.customize_panel.addEventAt("pencil", "click", function() {
            wall.set_feather(0);
        });

        // смена толщины пера
        wall.customize_panel.addEventAt("width_line", "blur", function(e) {
            var value = parseInt(this.value, 10),
                range = new Int8Array([this.min, this.max]);

            if (isNaN(value) || value <= range[0] || value > range[1]) {
                value = range[0];
            }

            return set_width(value);
        });

        // смена прозрачности пера
        wall.customize_panel.addEventAt("opacity_line", "blur", function(e) {
            var value = parseFloat(this.value, 10),
                range = new Float32Array([this.min, this.max]);

            if (isNaN(value) || value <= range[0] || value > range[1]) {
                value = range[1];
            }

            set_opacity(value);
        });
    };
})
