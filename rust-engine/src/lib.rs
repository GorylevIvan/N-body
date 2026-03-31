use js_sys::Math;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct NBodyEngine {
    n: usize,
    width: f64,
    height: f64,

    g: f64,
    dt: f64,
    softening: f64,
    bounce: f64,

    x: Vec<f64>,
    y: Vec<f64>,
    vx: Vec<f64>,
    vy: Vec<f64>,
    ax: Vec<f64>,
    ay: Vec<f64>,
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

            g: 30.0,
            dt: 0.016,
            softening: 8.0,
            bounce: 0.85,

            x: vec![0.0; n],
            y: vec![0.0; n],
            vx: vec![0.0; n],
            vy: vec![0.0; n],
            ax: vec![0.0; n],
            ay: vec![0.0; n],
            mass: vec![1.0; n],
        };

        engine.reset_disk();
        engine
    }

    pub fn reset_disk(&mut self) {
        let cx = self.width * 0.5;
        let cy = self.height * 0.5;
        let max_r = self.width.min(self.height) * 0.36;

        for i in 0..self.n {
            let angle = Math::random() * std::f64::consts::TAU;
            let r = Math::random().sqrt() * max_r;

            let px = cx + r * angle.cos();
            let py = cy + r * angle.sin();

            self.x[i] = px;
            self.y[i] = py;

            let dx = px - cx;
            let dy = py - cy;
            let dist = (dx * dx + dy * dy).sqrt() + 0.0001;

            let tx = -dy / dist;
            let ty = dx / dist;

            let speed = 0.4 + Math::random() * 1.2;
            self.vx[i] = tx * speed;
            self.vy[i] = ty * speed;

            self.mass[i] = 1.0 + Math::random() * 6.0;
            self.ax[i] = 0.0;
            self.ay[i] = 0.0;
        }
    }

    pub fn reset_random(&mut self) {
        for i in 0..self.n {
            self.x[i] = Math::random() * self.width;
            self.y[i] = Math::random() * self.height;
            self.vx[i] = (Math::random() - 0.5) * 2.0;
            self.vy[i] = (Math::random() - 0.5) * 2.0;
            self.mass[i] = 1.0 + Math::random() * 6.0;
            self.ax[i] = 0.0;
            self.ay[i] = 0.0;
        }
    }

    pub fn resize_world(&mut self, width: f64, height: f64) {
        self.width = width;
        self.height = height;

        for i in 0..self.n {
            if self.x[i] > self.width {
                self.x[i] = self.width;
            }
            if self.y[i] > self.height {
                self.y[i] = self.height;
            }
        }
    }

    pub fn set_params(&mut self, g: f64, dt: f64, softening: f64, bounce: f64) {
        self.g = g;
        self.dt = dt;
        self.softening = softening.max(0.0001);
        self.bounce = bounce.clamp(0.0, 1.0);
    }

    pub fn bodies_count(&self) -> usize {
        self.n
    }

    pub fn step(&mut self) {
        let n = self.n;

        for i in 0..n {
            self.ax[i] = 0.0;
            self.ay[i] = 0.0;
        }

        for i in 0..n {
            for j in (i + 1)..n {
                let dx = self.x[j] - self.x[i];
                let dy = self.y[j] - self.y[i];

                let dist_sq = dx * dx + dy * dy + self.softening * self.softening;
                let dist = dist_sq.sqrt();
                let inv_dist3 = 1.0 / (dist_sq * dist);

                let ai = self.g * self.mass[j] * inv_dist3;
                let aj = self.g * self.mass[i] * inv_dist3;

                self.ax[i] += dx * ai;
                self.ay[i] += dy * ai;

                self.ax[j] -= dx * aj;
                self.ay[j] -= dy * aj;
            }
        }

        for i in 0..n {
            self.vx[i] += self.ax[i] * self.dt;
            self.vy[i] += self.ay[i] * self.dt;

            self.x[i] += self.vx[i] * self.dt * 60.0;
            self.y[i] += self.vy[i] * self.dt * 60.0;

            if self.x[i] < 0.0 {
                self.x[i] = 0.0;
                self.vx[i] *= -self.bounce;
            } else if self.x[i] > self.width {
                self.x[i] = self.width;
                self.vx[i] *= -self.bounce;
            }

            if self.y[i] < 0.0 {
                self.y[i] = 0.0;
                self.vy[i] *= -self.bounce;
            } else if self.y[i] > self.height {
                self.y[i] = self.height;
                self.vy[i] *= -self.bounce;
            }
        }
    }

    pub fn step_many(&mut self, iterations: usize) {
        for _ in 0..iterations {
            self.step();
        }
    }

    pub fn snapshot(&self) -> Vec<f64> {
        let mut out = Vec::with_capacity(self.n * 4);

        for i in 0..self.n {
            let speed = (self.vx[i] * self.vx[i] + self.vy[i] * self.vy[i]).sqrt();
            out.push(self.x[i]);
            out.push(self.y[i]);
            out.push(self.mass[i]);
            out.push(speed);
        }

        out
    }

    pub fn kinetic_energy(&self) -> f64 {
        let mut e = 0.0;
        for i in 0..self.n {
            let v2 = self.vx[i] * self.vx[i] + self.vy[i] * self.vy[i];
            e += 0.5 * self.mass[i] * v2;
        }
        e
    }

    pub fn potential_energy(&self) -> f64 {
        let mut e = 0.0;
        for i in 0..self.n {
            for j in (i + 1)..self.n {
                let dx = self.x[j] - self.x[i];
                let dy = self.y[j] - self.y[i];
                let dist =
                    (dx * dx + dy * dy + self.softening * self.softening).sqrt();
                e -= self.g * self.mass[i] * self.mass[j] / dist;
            }
        }
        e
    }

    pub fn total_energy(&self) -> f64 {
        self.kinetic_energy() + self.potential_energy()
    }
}
