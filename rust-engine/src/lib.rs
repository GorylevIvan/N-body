use wasm_bindgen::prelude::*;
use js_sys::Math;

#[wasm_bindgen]
pub struct NBodyEngine {
    n: usize,
    width: f64,
    height: f64,
    g: f64,
    dt: f64,
    softening: f64,

    x: Vec<f64>,
    y: Vec<f64>,
    vx: Vec<f64>,
    vy: Vec<f64>,
    mass: Vec<f64>,
}

#[wasm_bindgen]
impl NBodyEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(n: usize, width: f64, height: f64) -> NBodyEngine {
        let mut engine = NBodyEngine {
            n,
            width,
            height,
            g: 20.0,
            dt: 0.016,
            softening: 25.0,

            x: vec![0.0; n],
            y: vec![0.0; n],
            vx: vec![0.0; n],
            vy: vec![0.0; n],
            mass: vec![1.0; n],
        };

        engine.reset();
        engine
    }

    pub fn reset(&mut self) {
        let cx = self.width * 0.5;
        let cy = self.height * 0.5;
        let radius = self.width.min(self.height) * 0.35;

        for i in 0..self.n {
            let angle = Math::random() * std::f64::consts::PI * 2.0;
            let r = Math::random().sqrt() * radius;

            let px = cx + r * angle.cos();
            let py = cy + r * angle.sin();

            self.x[i] = px;
            self.y[i] = py;

            let dx = px - cx;
            let dy = py - cy;
            let dist = (dx * dx + dy * dy).sqrt() + 0.0001;

            let tangent_x = -dy / dist;
            let tangent_y = dx / dist;

            let speed = 0.3 + Math::random() * 0.7;
            self.vx[i] = tangent_x * speed;
            self.vy[i] = tangent_y * speed;

            self.mass[i] = 1.0 + Math::random() * 4.0;
        }
    }

    pub fn set_params(&mut self, g: f64, dt: f64, softening: f64) {
        self.g = g;
        self.dt = dt;
        self.softening = softening;
    }

    pub fn bodies_count(&self) -> usize {
        self.n
    }

    pub fn step(&mut self) {
        let n = self.n;
        let mut ax = vec![0.0; n];
        let mut ay = vec![0.0; n];

        for i in 0..n {
            for j in (i + 1)..n {
                let dx = self.x[j] - self.x[i];
                let dy = self.y[j] - self.y[i];

                let dist_sq = dx * dx + dy * dy + self.softening * self.softening;
                let dist = dist_sq.sqrt();
                let inv_dist3 = 1.0 / (dist_sq * dist);

                let force_i = self.g * self.mass[j] * inv_dist3;
                let force_j = self.g * self.mass[i] * inv_dist3;

                ax[i] += dx * force_i;
                ay[i] += dy * force_i;

                ax[j] -= dx * force_j;
                ay[j] -= dy * force_j;
            }
        }

        for i in 0..n {
            self.vx[i] += ax[i] * self.dt;
            self.vy[i] += ay[i] * self.dt;

            self.x[i] += self.vx[i] * self.dt * 60.0;
            self.y[i] += self.vy[i] * self.dt * 60.0;

            if self.x[i] < 0.0 {
                self.x[i] = 0.0;
                self.vx[i] *= -0.8;
            }
            if self.x[i] > self.width {
                self.x[i] = self.width;
                self.vx[i] *= -0.8;
            }
            if self.y[i] < 0.0 {
                self.y[i] = 0.0;
                self.vy[i] *= -0.8;
            }
            if self.y[i] > self.height {
                self.y[i] = self.height;
                self.vy[i] *= -0.8;
            }
        }
    }

    pub fn step_many(&mut self, iterations: usize) {
        for _ in 0..iterations {
            self.step();
        }
    }

    pub fn positions(&self) -> Vec<f64> {
        let mut out = Vec::with_capacity(self.n * 2);
        for i in 0..self.n {
            out.push(self.x[i]);
            out.push(self.y[i]);
        }
        out
    }

    pub fn total_kinetic_energy(&self) -> f64 {
        let mut e = 0.0;
        for i in 0..self.n {
            let v2 = self.vx[i] * self.vx[i] + self.vy[i] * self.vy[i];
            e += 0.5 * self.mass[i] * v2;
        }
        e
    }
}