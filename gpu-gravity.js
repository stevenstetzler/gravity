function do_test(size) {
    var size = parseInt(document.getElementById("size").value);

    var num_galaxies = 2;
    var galaxy_positions = [-2, 2];
    var galaxy_masses = [1, 1];
    var G = 1;
    
    const gpu = new GPU({"mode" : "gpu"});
    
    const convert_array_to_texture_kernel = gpu.createKernel(
        function(array) {
            return array[this.thread.x];
        }
    ).setDynamicOutput(
        true
    ).setPipeline(
        true
    );
    
    function convert_array_to_texture(array) {
        convert_array_to_texture_kernel.setOutput([array.length]);
        return convert_array_to_texture_kernel(array);
    }
    
    const acceleration_gpu = gpu.createKernel(
        function(tracer_positions, galaxy_positions, galaxy_masses, G) {
            var a = 0;
            var tracer = this.thread.x;
            var tracer_position = tracer_positions[tracer];
            for (var j = 0; j < 2; j++) {
                var galaxy_position = galaxy_positions[j];
                var galaxy_mass = galaxy_masses[j];
                var distance_squared = tracer_position * tracer_position + galaxy_position * galaxy_position;
                var a_mag = G * galaxy_mass / distance_squared;
    
                a += a_mag * (tracer_position - galaxy_position) / Math.sqrt(distance_squared);
            }
            return a;
        }
    ).setDynamicOutput(
        true
    ).setPipeline(
        true
    );
    
    const acceleration_cpu = function(tracer_positions, galaxy_positions, galaxy_masses, G) {
        var a = [];
        for (i = 0; i < size; i++) {
            a.push(0.);
        }
        for (var i = 0; i < size; i++) {
            var tracer = i;
            var tracer_position = tracer_positions[tracer];
            for (var j = 0; j < 2; j++) {
                var galaxy_position = galaxy_positions[j];
                var galaxy_mass = galaxy_masses[j];
                var distance_squared = tracer_position * tracer_position + galaxy_position * galaxy_position;
                var a_mag = G * galaxy_mass / distance_squared;
    
                a[i] += a_mag * (tracer_position - galaxy_position) / Math.sqrt(distance_squared);
            }
        }
        return a;
    }
    
    const update_position_gpu = gpu.createKernel(
        function(x, v, dt) {
            var i = this.thread.x;
            return x[i] + v[i] * dt;
        }
    ).setPipeline(
        true
    ).setDynamicOutput(
        true
    );
    
    const update_position_cpu = function(x, v, dt) {
        var pos = [];
        for (var i = 0; i < size; i++) {
            pos.push(x[i] + v[i] * dt);
        }
        return pos;
    }
    
    const update_position_cpu_inplace = function(x, v, dt) {
        for (var i = 0; i < size; i++) {
            x[i] = x[i] + v[i] * dt;
        }
        return x;
    }
    
    const update_velocity_gpu = gpu.createKernel(
        function(v, a, dt) {
            var i = this.thread.x;
            return v[i] + a[i] * dt;
        }
    ).setPipeline(
        true
    ).setDynamicOutput(
        true
    );
    
    const update_velocity_cpu = function(v, a, dt) {
        var vel = [];
        for (var i = 0; i < size; i++) {
            vel.push(v[i] + a[i] * dt);
        }
        return vel;
    }
    
    const update_velocity_cpu_inplace = function(v, a, dt) {
        for (var i = 0; i < size; i++) {
            v[i] = v[i] + a[i] * dt;
        }
        return v;
    }
    
    update_position_gpu.setOutput([size]);
    update_velocity_gpu.setOutput([size]);
    acceleration_gpu.setOutput([size]);
    
    var tracer_positions = [];
    for (var i = 0; i < size; i++) {
        tracer_positions.push(10 * Math.random());
    }
    var tracer_velocities = [];
    for (var i = 0; i < size; i++) {
        tracer_velocities.push(10 * Math.random());
    }
    
    console.time("convert to textures");
    var tracer_positions_texture = convert_array_to_texture(tracer_positions);
    var tracer_velocities_texture = convert_array_to_texture(tracer_velocities);
    var galaxy_positions_texture = convert_array_to_texture(galaxy_positions);
    var galaxy_masses_texture = convert_array_to_texture(galaxy_masses);
    var tracer_accelerations = acceleration_cpu(tracer_positions, galaxy_positions, galaxy_masses, G);
    var tracer_accelerations_texture = acceleration_gpu(tracer_positions_texture, galaxy_positions_texture, galaxy_masses_texture, G);
    console.timeEnd("convert to textures");
    
    function integrateGPU(dt) {
        var start = window.performance.now();
        var v_temp = update_velocity_gpu(tracer_velocities_texture, tracer_accelerations_texture, dt/2);
        var x_temp = update_position_gpu(tracer_positions_texture, v_temp, dt);
        var a_temp = acceleration_gpu(x_temp, galaxy_positions_texture, galaxy_masses_texture, G);
        v_temp = update_velocity_gpu(v_temp, a_temp, dt/2);
        tracer_positions_texture = x_temp;
        tracer_velocities_texture = v_temp;
        tracer_accelerations_texture = a_temp;
        var end = window.performance.now();
        return end - start;
    }
    
    function integrateCPU(dt) {
        var start = window.performance.now();
        var v_temp = update_velocity_cpu(tracer_velocities, tracer_accelerations, dt/2);
        var x_temp = update_position_cpu(tracer_positions, v_temp, dt);
        var a_temp = acceleration_cpu(x_temp, galaxy_positions, galaxy_masses, G);
        v_temp = update_velocity_cpu(v_temp, a_temp, dt/2);
        tracer_positions = x_temp;
        tracer_velocities = v_temp;
        tracer_accelerations = a_temp;
        var end = window.performance.now();
        return end - start;
    }
    
    function integrateCPUInPlace(dt) {
        var start = window.performance.now();
        var v_temp = update_velocity_cpu_inplace(tracer_velocities, tracer_accelerations, dt/2);
        var x_temp = update_position_cpu_inplace(tracer_positions, v_temp, dt);
        var a_temp = acceleration_cpu(x_temp, galaxy_positions, galaxy_masses, G);
        v_temp = update_velocity_cpu_inplace(v_temp, a_temp, dt/2);
        tracer_positions = x_temp;
        tracer_velocities = v_temp;
        tracer_accelerations = a_temp;
        var end = window.performance.now();
        return end - start;
    }
    
    function time(f, iterations) {
        var total_time = 0;
        for (var i = 0; i < iterations; i++) {
            total_time += f();
        }
        return total_time / iterations;
    }
    
    var GPU_timing_result = time(function() {
        return integrateGPU(0.01);
    }, 100);
    var GPU_timinig_string = "[GPU] average time = " + GPU_timing_result + " ms";
    console.log(GPU_timinig_string)
    document.getElementById("gpu-result").innerHTML = GPU_timinig_string;

    var CPU_timing_result = time(function() {
        return integrateCPU(0.01);
    }, 100);
    var CPU_timinig_string = "[CPU] average time = " + CPU_timing_result + " ms";
    console.log(CPU_timinig_string)
    document.getElementById("cpu-result").innerHTML = CPU_timinig_string;

    var CPU_inplace_timing_result = time(function() {
        return integrateCPUInPlace(0.01);
    }, 100);
    var CPU_inplace_timing_string = "[CPU Fast] average time = " + CPU_inplace_timing_result + " ms";
    console.log(CPU_inplace_timing_string)
    document.getElementById("cpu-result-inplace").innerHTML = CPU_inplace_timing_string;

    function cleanup() {
        tracer_positions_texture.delete();
        tracer_velocities_texture.delete();
        galaxy_positions_texture.delete();
        galaxy_masses_texture.delete();
        tracer_accelerations_texture.delete();
        // convert_array_to_texture_kernel.destroy();
        // acceleration_gpu.destroy();
        // update_position_gpu.destroy();
        // update_velocity_gpu.destroy();
        gpu.destroy();        
    }
    cleanup();
}

function handleSize(event) {
    if (event.keyCode == 13) {
        // Cancel the default action, if needed
        event.preventDefault();
        do_test();
    }
}

document.addEventListener(
    "DOMContentLoaded", 
    function() {
        do_test();
    }, 
    false
);
