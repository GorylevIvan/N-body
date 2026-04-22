use js_sys::Math;
use wasm_bindgen::prelude::*;

const THETA: f32 = 0.7;
const MAX_DEPTH: usize = 18;
const MIN_HALF_SIZE: f32 = 0.5;

#[derive(Clone, Copy)]
enum SolverMode {
    Direct,
    BarnesHut,
}

#[derive(Clone)]
struct OctreeNode {
    cx: f32,
    cy: f32,
    cz: f32,
    half: f32,

    mass: f32,
    com_x: f32,
    com_y: f32,
    com_z: f32,

    count: usize,
    children: [Option<usize>; 8],
    leaf_bodies: Vec<usize>,
}

impl OctreeNode {
    fn new(cx: f32, cy: f32, cz: f32, half: f32) -> Self {
        Self {
            cx,
            cy,
            cz,
            half,
            mass: 0.0,
            com_x: 0.0,
            com_y: 0.0,
            com_z: 0.0,
            count: 0,
            children: [None; 8],
            leaf_bodies: Vec::new(),
        }
    }

    fn contains_point(&self, x: f32, y: f32, z: f32) -> bool {
        x >= self.cx - self.half
            && x <= self.cx + self.half
            && y >= self.cy - self.half
            && y <= self.cy + self.half
            && z >= self.cz - self.half
            && z <= self.cz + self.half
    }
}

struct Octree {
    nodes: Vec<OctreeNode>,
}

impl Octree {
    fn new(
        indices: &[usize],
        x: &[f32],
        y: &[f32],
        z: &[f32],
        mass: &[f32],
        width: f32,
        height: f32,
        depth: f32,
    ) -> Self {
        let half = width.max(height).max(depth) * 0.5;
        let mut tree = Self { nodes: Vec::new() };
        tree.build_node(indices, x, y, z, mass, 0.0, 0.0, 0.0, half, 0);
        tree
    }

    fn build_node(
        &mut self,
        indices: &[usize],
        x: &[f32],
        y: &[f32],
        z: &[f32],
        mass: &[f32],
        cx: f32,
        cy: f32,
        cz: f32,
        half: f32,
        depth: usize,
    ) -> usize {
        let mut node = OctreeNode::new(cx, cy, cz, half);
        node.count = indices.len();

        if !indices.is_empty() {
            let mut total_mass = 0.0f32;
            let mut sum_x = 0.0f32;
            let mut sum_y = 0.0f32;
            let mut sum_z = 0.0f32;

            for &i in indices {
                let m = mass[i];
                total_mass += m;
                sum_x += x[i] * m;
                sum_y += y[i] * m;
                sum_z += z[i] * m;
            }

            node.mass = total_mass;
            if total_mass > 0.0 {
                node.com_x = sum_x / total_mass;
                node.com_y = sum_y / total_mass;
                node.com_z = sum_z / total_mass;
            }
        }

        let node_index = self.nodes.len();
        self.nodes.push(node);

        if indices.len() <= 1 || depth >= MAX_DEPTH || half <= MIN_HALF_SIZE {
            self.nodes[node_index].leaf_bodies = indices.to_vec();
            return node_index;
        }

        let child_half = half * 0.5;
        let mut buckets: [Vec<usize>; 8] = Default::default();

        for &i in indices {
            let mut oct = 0usize;
            if x[i] >= cx {
                oct |= 1;
            }
            if y[i] >= cy {
                oct |= 2;
            }
            if z[i] >= cz {
                oct |= 4;
            }
            buckets[oct].push(i);
        }

        let mut created_child = false;

        for oct in 0..8 {
            if buckets[oct].is_empty() {
                continue;
            }

            created_child = true;

            let child_cx = cx + if (oct & 1) != 0 { child_half } else { -child_half };
            let child_cy = cy + if (oct & 2) != 0 { child_half } else { -child_half };
            let child_cz = cz + if (oct & 4) != 0 { child_half } else { -child_half };

            let child_index = self.build_node(
                &buckets[oct],
                x,
                y,
                z,
                mass,
                child_cx,
                child_cy,
                child_cz,
                child_half,
                depth + 1,
            );

            self.nodes[node_index].children[oct] = Some(child_index);
        }

        if !created_child {
            self.nodes[node_index].leaf_bodies = indices.to_vec();
        }

        node_index
    }
}

#[wasm_bindgen]
pub struct NBodyEngine {
    n: usize,
    width: f32,
    height: f32,
    depth: f32,

    g: f32,
    dt: f32,
    softening: f32,
    bounce: f32,

    solver_mode: SolverMode,

    x: Vec<f32>,
    y: Vec<f32>,
    z: Vec<f32>,

    vx: Vec<f32>,
    vy: Vec<f32>,
    vz: Vec<f32>,

    ax: Vec<f32>,
    ay: Vec<f32>,
    az: Vec<f32>,

    mass: Vec<f32>,
    speeds: Vec<f32>,
    render_positions: Vec<f32>,
}

#[wasm_bindgen]
impl NBodyEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(n: usize, width: f32, height: f32, depth: f32) -> NBodyEngine {
        let mut engine = NBodyEngine {
            n,
            width,
            height,
            depth,

            g: 30.0,
            dt: 0.016,
            softening: 8.0,
            bounce: 0.85,

            solver_mode: SolverMode::BarnesHut,

            x: vec![0.0; n],
            y: vec![0.0; n],
            z: vec![0.0; n],

            vx: vec![0.0; n],
            vy: vec![0.0; n],
            vz: vec![0.0; n],

            ax: vec![0.0; n],
            ay: vec![0.0; n],
            az: vec![0.0; n],

            mass: vec![1.0; n],
            speeds: vec![0.0; n],
            render_positions: vec![0.0; n * 3],
        };

        engine.reset_galaxy();
        engine
    }

    pub fn set_solver_mode(&mut self, mode: &str) {
        self.solver_mode = match mode {
            "direct" => SolverMode::Direct,
            _ => SolverMode::BarnesHut,
        };
    }

    pub fn resize_world(&mut self, width: f32, height: f32, depth: f32) {
        self.width = width;
        self.height = height;
        self.depth = depth;

        let hx = self.width * 0.5;
        let hy = self.height * 0.5;
        let hz = self.depth * 0.5;

        for i in 0..self.n {
            self.x[i] = self.x[i].clamp(-hx, hx);
            self.y[i] = self.y[i].clamp(-hy, hy);
            self.z[i] = self.z[i].clamp(-hz, hz);
        }

        self.sync_render_buffers();
    }

    pub fn set_params(&mut self, g: f32, dt: f32, softening: f32, bounce: f32) {
        self.g = g;
        self.dt = dt;
        self.softening = softening.max(0.0001);
        self.bounce = bounce.clamp(0.0, 1.0);
    }

    pub fn bodies_count(&self) -> usize {
        self.n
    }

    pub fn positions_ptr(&self) -> *const f32 {
        self.render_positions.as_ptr()
    }

    pub fn masses_ptr(&self) -> *const f32 {
        self.mass.as_ptr()
    }

    pub fn speeds_ptr(&self) -> *const f32 {
        self.speeds.as_ptr()
    }

    pub fn positions_len(&self) -> usize {
        self.render_positions.len()
    }

    pub fn scalars_len(&self) -> usize {
        self.n
    }

    pub fn reset_galaxy(&mut self) {
        let radius = self.width.min(self.depth) * 0.28;
        let thickness = self.height * 0.12;

        for i in 0..self.n {
            let angle = (Math::random() as f32) * std::f32::consts::TAU;
            let r = (Math::random() as f32).sqrt() * radius;

            let x = r * angle.cos();
            let z = r * angle.sin();
            let y = ((Math::random() as f32) - 0.5) * thickness;

            self.x[i] = x;
            self.y[i] = y;
            self.z[i] = z;

            let dist = (x * x + z * z).sqrt() + 0.0001;
            let tx = -z / dist;
            let tz = x / dist;

            let speed = 0.45 + (Math::random() as f32) * 1.2;
            self.vx[i] = tx * speed;
            self.vy[i] = ((Math::random() as f32) - 0.5) * 0.08;
            self.vz[i] = tz * speed;

            self.mass[i] = 1.0 + (Math::random() as f32) * 6.0;
        }

        self.sync_render_buffers();
    }

    pub fn reset_collapse(&mut self) {
        let hx = self.width * 0.5;
        let hy = self.height * 0.5;
        let hz = self.depth * 0.5;

        for i in 0..self.n {
            let x = ((Math::random() as f32) - 0.5) * self.width;
            let y = ((Math::random() as f32) - 0.5) * self.height;
            let z = ((Math::random() as f32) - 0.5) * self.depth;

            self.x[i] = x;
            self.y[i] = y;
            self.z[i] = z;

            let dx = -x;
            let dy = -y;
            let dz = -z;
            let dist = (dx * dx + dy * dy + dz * dz).sqrt() + 0.0001;

            let speed = 0.25 + (Math::random() as f32) * 1.0;
            self.vx[i] = dx / dist * speed;
            self.vy[i] = dy / dist * speed;
            self.vz[i] = dz / dist * speed;

            self.mass[i] = 1.0 + (Math::random() as f32) * 5.0;

            self.x[i] = self.x[i].clamp(-hx, hx);
            self.y[i] = self.y[i].clamp(-hy, hy);
            self.z[i] = self.z[i].clamp(-hz, hz);
        }

        self.sync_render_buffers();
    }

    pub fn reset_explosion(&mut self) {
        let sphere_radius = self.width.min(self.height).min(self.depth) * 0.22;

        for i in 0..self.n {
            let theta = (Math::random() as f32) * std::f32::consts::TAU;
            let phi = ((Math::random() as f32) * 2.0 - 1.0).acos();
            let r = (Math::random() as f32).cbrt() * sphere_radius;

            let sin_phi = phi.sin();

            let x = r * sin_phi * theta.cos();
            let y = r * phi.cos();
            let z = r * sin_phi * theta.sin();

            self.x[i] = x;
            self.y[i] = y;
            self.z[i] = z;

            let dx = -x;
            let dy = -y;
            let dz = -z;

            let dist = (dx * dx + dy * dy + dz * dz).sqrt() + 0.0001;

            let speed = 0.35 + (Math::random() as f32) * 1.4;

            let mut vx = dx / dist * speed;
            let mut vy = dy / dist * speed;
            let mut vz = dz / dist * speed;

            vx += ((Math::random() as f32) - 0.5) * 0.18;
            vy += ((Math::random() as f32) - 0.5) * 0.18;
            vz += ((Math::random() as f32) - 0.5) * 0.18;

            self.vx[i] = vx;
            self.vy[i] = vy;
            self.vz[i] = vz;

            self.mass[i] = 1.0 + (Math::random() as f32) * 4.0;
        }

        self.sync_render_buffers();
    }

    pub fn reset_two_galaxies(&mut self) {
        let half = self.n / 2;
        let left_center_x = -self.width * 0.22;
        let right_center_x = self.width * 0.22;
        let radius = self.width.min(self.depth) * 0.14;
        let thickness = self.height * 0.10;

        for i in 0..half {
            let angle = (Math::random() as f32) * std::f32::consts::TAU;
            let r = (Math::random() as f32).sqrt() * radius;

            let local_x = r * angle.cos();
            let local_z = r * angle.sin();
            let local_y = ((Math::random() as f32) - 0.5) * thickness;

            self.x[i] = left_center_x + local_x;
            self.y[i] = local_y;
            self.z[i] = local_z;

            let dist = (local_x * local_x + local_z * local_z).sqrt() + 0.0001;
            let tx = -local_z / dist;
            let tz = local_x / dist;

            let orbit_speed = 0.35 + (Math::random() as f32) * 0.8;
            self.vx[i] = tx * orbit_speed + 0.65;
            self.vy[i] = ((Math::random() as f32) - 0.5) * 0.05;
            self.vz[i] = tz * orbit_speed;

            self.mass[i] = 1.0 + (Math::random() as f32) * 5.0;
        }

        for i in half..self.n {
            let angle = (Math::random() as f32) * std::f32::consts::TAU;
            let r = (Math::random() as f32).sqrt() * radius;

            let local_x = r * angle.cos();
            let local_z = r * angle.sin();
            let local_y = ((Math::random() as f32) - 0.5) * thickness;

            self.x[i] = right_center_x + local_x;
            self.y[i] = local_y;
            self.z[i] = local_z;

            let dist = (local_x * local_x + local_z * local_z).sqrt() + 0.0001;
            let tx = local_z / dist;
            let tz = -local_x / dist;

            let orbit_speed = 0.35 + (Math::random() as f32) * 0.8;
            self.vx[i] = tx * orbit_speed - 0.65;
            self.vy[i] = ((Math::random() as f32) - 0.5) * 0.05;
            self.vz[i] = tz * orbit_speed;

            self.mass[i] = 1.0 + (Math::random() as f32) * 5.0;
        }

        self.sync_render_buffers();
    }

    pub fn step(&mut self) {
        match self.solver_mode {
            SolverMode::Direct => self.step_direct(),
            SolverMode::BarnesHut => self.step_barnes_hut(),
        }

        self.integrate_and_bounce();
        self.sync_render_buffers();
    }

    pub fn step_many(&mut self, iterations: usize) {
        for _ in 0..iterations {
            self.step();
        }
    }

    pub fn kinetic_energy(&self) -> f32 {
        let mut e = 0.0;
        for i in 0..self.n {
            let v2 =
                self.vx[i] * self.vx[i] +
                self.vy[i] * self.vy[i] +
                self.vz[i] * self.vz[i];
            e += 0.5 * self.mass[i] * v2;
        }
        e
    }

    pub fn potential_energy(&self) -> f32 {
        let mut e = 0.0;
        for i in 0..self.n {
            for j in (i + 1)..self.n {
                let dx = self.x[j] - self.x[i];
                let dy = self.y[j] - self.y[i];
                let dz = self.z[j] - self.z[i];
                let dist = (dx * dx + dy * dy + dz * dz + self.softening * self.softening).sqrt();
                e -= self.g * self.mass[i] * self.mass[j] / dist;
            }
        }
        e
    }

    pub fn total_energy(&self) -> f32 {
        self.kinetic_energy() + self.potential_energy()
    }
}

impl NBodyEngine {
    fn clear_acceleration(&mut self) {
        for i in 0..self.n {
            self.ax[i] = 0.0;
            self.ay[i] = 0.0;
            self.az[i] = 0.0;
        }
    }

    fn step_direct(&mut self) {
        self.clear_acceleration();

        for i in 0..self.n {
            let xi = self.x[i];
            let yi = self.y[i];
            let zi = self.z[i];
            let mi = self.mass[i];

            for j in (i + 1)..self.n {
                let dx = self.x[j] - xi;
                let dy = self.y[j] - yi;
                let dz = self.z[j] - zi;

                let dist_sq = dx * dx + dy * dy + dz * dz + self.softening * self.softening;
                let inv_dist = dist_sq.sqrt().recip();
                let inv_dist3 = inv_dist * inv_dist * inv_dist;

                let ai = self.g * self.mass[j] * inv_dist3;
                let aj = self.g * mi * inv_dist3;

                self.ax[i] += dx * ai;
                self.ay[i] += dy * ai;
                self.az[i] += dz * ai;

                self.ax[j] -= dx * aj;
                self.ay[j] -= dy * aj;
                self.az[j] -= dz * aj;
            }
        }
    }

    fn step_barnes_hut(&mut self) {
        self.clear_acceleration();

        let indices: Vec<usize> = (0..self.n).collect();
        let tree = Octree::new(
            &indices,
            &self.x,
            &self.y,
            &self.z,
            &self.mass,
            self.width,
            self.height,
            self.depth,
        );

        for i in 0..self.n {
            let (ax, ay, az) = self.compute_force_from_tree(&tree, 0, i);
            self.ax[i] = ax;
            self.ay[i] = ay;
            self.az[i] = az;
        }
    }

    fn sync_render_buffers(&mut self) {
        for i in 0..self.n {
            let p = i * 3;
            self.render_positions[p] = self.x[i];
            self.render_positions[p + 1] = self.y[i];
            self.render_positions[p + 2] = self.z[i];

            self.speeds[i] = (
                self.vx[i] * self.vx[i] +
                self.vy[i] * self.vy[i] +
                self.vz[i] * self.vz[i]
            ).sqrt();
        }
    }

    fn compute_force_from_tree(&self, tree: &Octree, node_index: usize, target: usize) -> (f32, f32, f32) {
        let node = &tree.nodes[node_index];

        if node.count == 0 || node.mass <= 0.0 {
            return (0.0, 0.0, 0.0);
        }

        let tx = self.x[target];
        let ty = self.y[target];
        let tz = self.z[target];

        if !node.leaf_bodies.is_empty() {
            let mut ax = 0.0;
            let mut ay = 0.0;
            let mut az = 0.0;

            for &j in &node.leaf_bodies {
                if j == target {
                    continue;
                }

                let dx = self.x[j] - tx;
                let dy = self.y[j] - ty;
                let dz = self.z[j] - tz;

                let dist_sq = dx * dx + dy * dy + dz * dz + self.softening * self.softening;
                let inv_dist = dist_sq.sqrt().recip();
                let inv_dist3 = inv_dist * inv_dist * inv_dist;

                let a = self.g * self.mass[j] * inv_dist3;
                ax += dx * a;
                ay += dy * a;
                az += dz * a;
            }

            return (ax, ay, az);
        }

        let dx = node.com_x - tx;
        let dy = node.com_y - ty;
        let dz = node.com_z - tz;

        let dist_sq = dx * dx + dy * dy + dz * dz + self.softening * self.softening;
        let dist = dist_sq.sqrt();

        let size = node.half * 2.0;
        let contains_target = node.contains_point(tx, ty, tz);

        if !contains_target && (size / dist) < THETA {
            let inv_dist = dist.recip();
            let inv_dist3 = inv_dist * inv_dist * inv_dist;
            let a = self.g * node.mass * inv_dist3;
            return (dx * a, dy * a, dz * a);
        }

        let mut ax = 0.0;
        let mut ay = 0.0;
        let mut az = 0.0;

        for child in node.children.iter().flatten() {
            let (cx, cy, cz) = self.compute_force_from_tree(tree, *child, target);
            ax += cx;
            ay += cy;
            az += cz;
        }

        (ax, ay, az)
    }

    fn integrate_and_bounce(&mut self) {
        let hx = self.width * 0.5;
        let hy = self.height * 0.5;
        let hz = self.depth * 0.5;
        let dt60 = self.dt * 60.0;

        for i in 0..self.n {
            self.vx[i] += self.ax[i] * self.dt;
            self.vy[i] += self.ay[i] * self.dt;
            self.vz[i] += self.az[i] * self.dt;

            self.x[i] += self.vx[i] * dt60;
            self.y[i] += self.vy[i] * dt60;
            self.z[i] += self.vz[i] * dt60;

            if self.x[i] < -hx {
                self.x[i] = -hx;
                self.vx[i] *= -self.bounce;
            } else if self.x[i] > hx {
                self.x[i] = hx;
                self.vx[i] *= -self.bounce;
            }

            if self.y[i] < -hy {
                self.y[i] = -hy;
                self.vy[i] *= -self.bounce;
            } else if self.y[i] > hy {
                self.y[i] = hy;
                self.vy[i] *= -self.bounce;
            }

            if self.z[i] < -hz {
                self.z[i] = -hz;
                self.vz[i] *= -self.bounce;
            } else if self.z[i] > hz {
                self.z[i] = hz;
                self.vz[i] *= -self.bounce;
            }
        }
    }
}
