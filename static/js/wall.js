define(function() {
    return function(canvas, customize_panel, user_list) {
        if (this instanceof Window) {
            throw new Error("this must be Wall");
        }

        if (!canvas || !customize_panel || !user_list) {
            throw new Error("canvas or customize_panel or user_list wasn't found");
        }

        var points = [];

        /**
         * init
         *
         * Получаем уже имеющиеся координаты с сервера (возможно от других участников) и рисуем их на текущем канвасе,
         * а также устанавливаем все дефолтные значения для курсора.
         */
        this.init = function() {
            this.canvas = canvas;
            this.customize_panel = customize_panel;
            this.user_list = user_list;
            this.ctx = canvas.getContext("2d");
            this.first_coordinates = {
                "left" : this.canvas.offsetLeft,
                "top"  : this.canvas.offsetTop
            };

            /**
             * feather имеет 3 статуса:
             *   0 - карандаш (by default)
             *   1 - фломастер
             *   2 - ластик
             */
            this.feather = 1;

            var draw = this.customize_panel.querySelector(".draw_element");

            if (draw) {
                switch (draw.id) {
                    case "pencil" :
                        this.feather = 0;
                        break;
                    case "felt_pen" :
                        this.feather = 1;
                        break;
                    case "eraser" :
                        this.feather = 2;
                        break;
                }
            }
        };

        this.init();

        /**
         * Метод устанавливает текущее перо, а также меняет класс активному перу в дереве DOM
         */
        this.set_feather = function(f) {
            if (typeof f !== "number") {
                throw new Error("`f` have to be number");
            }

            if (!(f in new Int8Array([0, 1, 2]))) {
                throw new Error("`f` have to be 0 or 1 or 2");
            }

            this.feather = f;

            this.customize_panel.querySelector(".draw_element").classList.remove("draw_element");

            switch (this.feather) {
                case 0 :
                    this.customize_panel.querySelector("#pencil").classList.add("draw_element");
                    break;
                case 1 :
                    this.customize_panel.querySelector("#felt_pen").classList.add("draw_element");
                    break;
                case 2 :
                    this.customize_panel.querySelector("#eraser").classList.add("draw_element");
                    break;
            }
        };

        /**
         * назначить обработчик (handler) на дочерний элемент (с переданным id) customize_panel
         */
        this.customize_panel.addEventAt = function(id, event, handler) {
            if (!id) {
                throw new Error("id can not be blank");
            }

            id[0] !== '#' ? id = '#' + id : id;

            var element = this.querySelector(id);

            if (!element) {
                return false;
            }

            element.addEventListener(event, handler);
            return true;
        };

        /**
         * Метод рисует одну точку по заданным координатам
         */
        this.draw_point = function(move_to, line_to) {
            points.push(new Int16Array([move_to[0], move_to[1], line_to[0], line_to[1]]));
            this.ctx.beginPath();
            this.ctx.moveTo(move_to[0], move_to[1]);
            this.ctx.lineTo(line_to[0], line_to[1]);
            this.ctx.stroke();
        };

        /**
         * Метод удаляет одну точку по заданным координатам
         */
        this.clear_point = function(move_to, line_to) {
            points.push(new Int16Array([move_to[0], move_to[1], line_to[0], line_to[1]]));
            var width = this.ctx.lineWidth,
                height = this.ctx.lineWidth;

            // Сохраняем текущую матрицу трансформации
            this.ctx.save();
            // Используем идентичную матрицу трансформации на время очистки
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.clearRect(move_to[0] - (width / 2), move_to[1] - (height / 2), width, height);
            // Возобновляем матрицу трансформации
            this.ctx.restore();
        };

        // Метод обновляет список пользователей по полученному объекту
        // и для каждого пользователя создает экземпляр User
        this.update_user_list = function(users) {
            var i,
                u,
                dom = ''
            ;

            for (i in users) {
                u = new WALL.User(users[i]);
                u.save();
            }

            var users = WALL.User.array_all();

            for (i = 0; i < users.length; i += 1) {
                dom += "<div>" + users[i].name  + "</div>";
            }

            user_list.innerHTML = dom;
        };

        // Метод возвращает данные содержащие активные линии, прозрачность и т.п для отправки на сервер с рисуемой линией
        this.get_data = function() {
            return {
                'f'  : this.feather,
                'lw' : this.ctx.lineWidth,
                'ss' : this.ctx.strokeStyle,
                'ga' : this.ctx.globalAlpha,
            };
        };

        this.put_line = function(line, user_id) {
            var user =  WALL.User.find(user_id);

            if (!user) {
                user = WALL.User.find(0);
            }

            if (!user.coordinates) {
                user.coordinates = [];
            }

            user.coordinates.push(line);

            return this.draw(line);
        };

        this.get_points = function() {
            return points;
        };

        this.clear_points = function() {
            points = [];
        };

        // Метод рисует линию по полученным точкам
        // line.points - массив точек
        // line.data - Объект содержащий данные, о том как эти точки были нарисованы
        this.draw = function(line) {
            var startLineTo, finishLineTo, i = 0,
            old_data = {
                'globalAlpha' : this.ctx.globalAlpha,
                'lineWidth'   : this.ctx.lineWidth,
                'strokeStyle' : this.ctx.strokeStyle,
            };

            var ctx = this.ctx;

            ctx.beginPath();
            ctx.globalAlpha = line.data.ga;
            ctx.lineWidth   = line.data.lw;
            ctx.strokeStyle = line.data.ss;

            for (; i < line.points.length; i += 1) {
                if (line.data.f === 0 || line.data.f === 1) {
                    ctx.moveTo(line.points[i][0], line.points[i][1]);
                    ctx.lineTo(line.points[i][2], line.points[i][3]);
                } else if (line.data.f === 2) {
                    // Сохраняем текущую матрицу трансформации
                    ctx.save();
                    // Используем идентичную матрицу трансформации на время очистки
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.clearRect(line.points[i][0] - (this.ctx.lineWidth / 2), line.points[i][1] - (this.ctx.lineWidth / 2), this.ctx.lineWidth, this.ctx.lineWidth);
                    // Возобновляем матрицу трансформации
                    ctx.restore();
                }
            }
            ctx.stroke();

            this.ctx.globalAlpha = old_data.globalAlpha;
            this.ctx.lineWidth = old_data.lineWidth;
            this.ctx.strokeStyle = old_data.strokeStyle;
        };
    }
});
