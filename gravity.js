function makeCanvas() {
    var canvas = document.getElementById("html-canvas");
    var empty = document.createElement("canvas");
    empty.width = empty.height = 1;
    canvas.style.cursor = 'url('+empty.toDataURL()+')';
    // Set actual size in memory (scaled to account for extra pixel density).
    var scale = 1 //window.devicePixelRatio; // <--- Change to 1 on retina screens to see blurry canvas.

    var rect = canvas.getBoundingClientRect();
    canvas.width = window.innerWidth * scale;
    canvas.height = (window.innerHeight - rect.y) * scale;
    canvas.style.position = 'absolute';
    canvas.style.left = '0px';

    var context = canvas.getContext("2d");
    context.scale(scale, scale);

    return [canvas, context];
}

function drawCircle(context, x, y, radius, border, border_colour, fill_colour, alpha) {
    var prevAlpha = context.globalAlpha;
    context.globalAlpha = alpha;
    context.beginPath();
    context.arc(x, y, radius, 0, 2*Math.PI);
    context.strokeStyle = border_colour;
    context.fillStyle = fill_colour;
    context.lineWidth = border;
    context.closePath();
    context.fill();
    context.stroke();
    context.globalAlpha = prevAlpha;
}
  
function randomColour() {
    var chars = '0123456789ABCDEF';
    var colour = '#';
    for (var i = 0; i < 6; i++) {
        colour += chars[Math.floor(Math.random() * 16)];
    }
    return colour; 
}

// Leapfrog integration for object i advancing by time dt computing accelerations for the object on the fly using the function a_compute
function leapFrog(dt, i, object, a_compute) {
    var x_t = object.x;
    var v_t = object.v;
    var a_t = object.a;

    var dim = x_t.length;
    if (dim) {
        // compute velocity at half timestep
        var v_t_plus_half = [];
        for (var d = 0; d < dim; d++) {
            v_t_plus_half.push(v_t[d] + a_t[d] * dt / 2);
        }
        // compute position at next timestep and update position array
        var x_t_plus_one = [];
        for (var d = 0; d < dim; d++) {
            x_t_plus_one.push(x_t[d] + v_t_plus_half[d] * dt);
        }
        object.x = x_t_plus_one;

        // compute acceleration at the next timestep and update acceleration array
        var a_t_plus_one = a_compute(i, object);
        object.a = a_t_plus_one;

        // update the velocity at next timestep and update velocity array
        var v_t_plus_one = [];
        for (var d = 0; d < dim; d++) {
            v_t_plus_one.push(v_t_plus_half[d] + a_t_plus_one[d] * dt / 2);
        }
        object.v = v_t_plus_one;
    } else {
        // compute velocity at half timestep
        var v_t_plus_half = v_t + a_t * dt / 2;

        // compute position at next timestep and update position array
        var x_t_plus_one = x_t + v_t_plus_half * dt;
        object.x = x_t_plus_one;

        // compute acceleration at the next timestep and update acceleration array
        var a_t_plus_one = a_compute(i, object);
        object.a = a_t_plus_one;

        // update the velocity at next timestep and update velocity array
        var v_t_plus_one = v_t_plus_half + a_t_plus_one * dt / 2;
        object.v = v_t_plus_one;
    }
}

// Compute the tangential velocity required to keep object o_1 in a circular orbit around o_2 sustained by gravity
function circleV(o_1, o_2) {
    var dim = o_1.x.length;
    var dist = 0;
    for (var d = 0; d < dim; d++) {
        var dDim = o_1.x[d] - o_2.x[d];
        dist += dDim * dDim;
    }
    dist = Math.sqrt(dist);
    return Math.sqrt(G * o_2.mass / dist);
}

// Convert text in HTML inputs into variables in JavaScript
function parseInput() {
    n_tracers = parseInt(document.getElementById("N").value);
    dt = parseFloat(document.getElementById("dt").value);
}

// Handle changes to the number of trace particles
function handleNumTracers(event) {
    if (event.keyCode == 13) {
        // Cancel the default action, if needed
        event.preventDefault();
        parseInput();
        reset();
    }
}

// Handle changes to the integration time dt
function handleDT(event) {
    if (event.keyCode == 13) {
        // Cancel the default action, if needed
        event.preventDefault();
        parseInput();
    }
}

function reset() {
    step = init();
    if (GO) {
        stop();
        setTimeout(start, 100);
    } else {
        stop();
        setTimeout(step, 100);
    }
}

// Start the simulation
function start() {
    if (! GO) {
        GO = true;
        if (step) {
            step();
        }    
    }
}

// Stop the simulation
function stop() {
    GO = false;
}

// Initialize the simulation
function init() {
    var [canvas, context] = makeCanvas();
    parseInput();
    var distance = 0.3 * canvas.width;

    var objects = [
        {
            x: [
                0.5 * canvas.width - distance / 2,
                0.5 * canvas.height,
            ],
            v: [
                0.,
                Math.sqrt(G * 100 * (distance / 2) / ((distance * distance)))
            ],
            r: 20,
            mass: 100,
            colour: "#ff9500",
        },
        {
            x: [
                0.5 * canvas.width + distance / 2,
                0.5 * canvas.height,
            ],
            v: [
                0.,
                -Math.sqrt(G * 100 * (distance / 2) / ((distance * distance)))
            ],
            r: 20,
            mass: 100,
            colour: "#37ba07",
        },
    ];

    var a_compute = function(i, o_i) {
        var dim = o_i.x.length;
        var a = [];
        for (var d = 0; d < dim; d++) {
            a.push(0.);
        }
        for (var j = 0; j < objects.length; j++) {
            if (j == i) {
                continue;
            }
            var o_j = objects[j];
            var dist = 0;
            for (var d = 0; d < dim; d++) {
                var diff = o_i.x[d] - o_j.x[d];
                dist += diff * diff;
            }
            dist = Math.sqrt(dist);
            if (dist < 2) {
                continue;
            }
            var a_mag = (G * o_j.mass) / (dist * dist);
            for (var d = 0; d < dim; d++) {
                var diff = o_j.x[d] - o_i.x[d];
                a[d] += a_mag * (diff / dist);
            }
        }
        return a;
    };

    for (var i in objects) {
        objects[i].a = a_compute(i, objects[i]);
    }

    var tracers = []
    for (var i = 0; i < parseInt(n_tracers / objects.length); i++) {
        for (var j = 0; j < objects.length; j++) {
            var galaxy = objects[j];

            var angle = Math.random() * 2 * Math.PI;
            var radius = Math.random() * 300 + 30;
            var center = galaxy.x;
            var tracer_x = center[0] + radius * Math.cos(angle);
            var tracer_y = center[1] + radius * Math.sin(angle);
            var tracer = {
                x: [
                    tracer_x,
                    tracer_y,
                ],
                r: 5,
                colour: "#8560b5"
            };
            var tracer_v_mag = circleV(tracer, galaxy);
            var tracer_v_x = tracer_v_mag * Math.cos(angle - Math.PI / 2);
            var tracer_v_y = tracer_v_mag * Math.sin(angle - Math.PI / 2);
            tracer.v = [
                tracer_v_x + galaxy.v[0], 
                tracer_v_y + galaxy.v[1]
            ];
            tracers.push(
                tracer
            );
        }
    }

    var a_compute_tracer = function(i, o_i) {
        var dim = o_i.x.length;
        var a = [];
        for (var d = 0; d < dim; d++) {
            a.push(0.);
        }
        for (var j = 0; j < objects.length; j++) {
            var o_j = objects[j];
            var dist = 0;
            for (var d = 0; d < dim; d++) {
                var diff = o_i.x[d] - o_j.x[d];
                dist += diff * diff;
            }
            dist = Math.sqrt(dist);
            if (dist < 2) {
                continue;
            }
            var a_mag = (G * o_j.mass) / (dist * dist);
            for (var d = 0; d < dim; d++) {
                var diff = o_j.x[d] - o_i.x[d];
                a[d] += a_mag * (diff / dist);
                // console.log(i, j, d, a[d]);
            }
        }
        return a;
    };

    for (var i in tracers) {
        tracers[i].a = a_compute_tracer(i, tracers[i]);
    }

    var draw = function(timestep) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        objects.forEach(
            function (object) {
                drawCircle(context, object.x[0], object.x[1], object.r, 0, object.colour, object.colour, 1);
            }
        );
        tracers.forEach(
            function (object) {
                drawCircle(context, object.x[0], object.x[1], object.r, 0, object.colour, object.colour, 0.3);
            }
        );
    }

    var _step = function(t) {
        var start = window.performance.now();
        for (var i = 0; i < objects.length; i++) {
            leapFrog(dt, i, objects[i], a_compute);
        }
        for (var i = 0; i < tracers.length; i++) {
            leapFrog(dt, i, tracers[i], a_compute_tracer);
        }
        var end = window.performance.now();
        var timeIntegrate = end - start;

        start = window.performance.now();
        draw();
        end = window.performance.now();
        var timeRender = end - start;
        
        context.font = '24px serif';
        context.fillStyle = "#000000";
        context.fillText("Integrate: " + timeIntegrate.toFixed(2) + " ms", 10, 30);
        context.fillText("Render: " + timeRender.toFixed(2) + " ms", 10, 60);

        if (GO) {
            requestAnimationFrame(_step);
        }
    }
    return _step;
}


var step;
var GO = false;

var G = 1;
var n_tracers;
var dt;

document.addEventListener(
    "DOMContentLoaded", function() {
        reset();
    },
    false
)
