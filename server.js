const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件
app.use(express.static(path.join(__dirname, 'public')));

// 确保 uploads 目录存在
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ===== JSON 数据存储 =====
const DATA_FILE = path.join(__dirname, 'data.json');

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const init = { brands: [], series: [], models: [], cars: [], nextId: { brands: 1, series: 1, models: 1, cars: 1 } };
    fs.writeFileSync(DATA_FILE, JSON.stringify(init, null, 2), 'utf-8');
    return init;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// 图片上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ========== 品牌 API ==========
app.get('/api/brands', (req, res) => {
  const data = loadData();
  res.json(data.brands.slice().sort((a, b) => a.name.localeCompare(b.name, 'zh')));
});

app.post('/api/brands', (req, res) => {
  const { name, logo } = req.body;
  if (!name) return res.status(400).json({ error: '品牌名称不能为空' });
  const data = loadData();
  if (data.brands.some(b => b.name === name)) return res.status(400).json({ error: '品牌已存在' });
  const brand = { id: data.nextId.brands++, name, logo: logo || '' };
  data.brands.push(brand);
  saveData(data);
  res.json(brand);
});

app.put('/api/brands/:id', (req, res) => {
  const { name, logo } = req.body;
  const data = loadData();
  const brand = data.brands.find(b => b.id == req.params.id);
  if (!brand) return res.status(404).json({ error: '品牌不存在' });
  brand.name = name;
  brand.logo = logo || '';
  saveData(data);
  res.json({ success: true });
});

app.delete('/api/brands/:id', (req, res) => {
  const data = loadData();
  const idx = data.brands.findIndex(b => b.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: '品牌不存在' });
  data.brands.splice(idx, 1);
  // 级联删除
  const seriesIds = data.series.filter(s => s.brand_id == req.params.id).map(s => s.id);
  data.series = data.series.filter(s => s.brand_id != req.params.id);
  data.models = data.models.filter(m => !seriesIds.includes(m.series_id));
  data.cars = data.cars.filter(c => c.brand_id != req.params.id);
  saveData(data);
  res.json({ success: true });
});

// ========== 车系 API ==========
app.get('/api/series', (req, res) => {
  const data = loadData();
  let series = data.series;
  if (req.query.brand_id) series = series.filter(s => s.brand_id == req.query.brand_id);
  res.json(series.slice().sort((a, b) => a.name.localeCompare(b.name, 'zh')));
});

app.post('/api/series', (req, res) => {
  const { brand_id, name } = req.body;
  if (!brand_id || !name) return res.status(400).json({ error: '参数不完整' });
  const data = loadData();
  const s = { id: data.nextId.series++, brand_id: Number(brand_id), name };
  data.series.push(s);
  saveData(data);
  res.json(s);
});

app.put('/api/series/:id', (req, res) => {
  const { name } = req.body;
  const data = loadData();
  const s = data.series.find(x => x.id == req.params.id);
  if (!s) return res.status(404).json({ error: '车系不存在' });
  s.name = name;
  saveData(data);
  res.json({ success: true });
});

app.delete('/api/series/:id', (req, res) => {
  const data = loadData();
  const idx = data.series.findIndex(s => s.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: '车系不存在' });
  data.series.splice(idx, 1);
  data.models = data.models.filter(m => m.series_id != req.params.id);
  data.cars = data.cars.filter(c => c.series_id != req.params.id);
  saveData(data);
  res.json({ success: true });
});

// ========== 车型 API ==========
app.get('/api/models', (req, res) => {
  const data = loadData();
  let models = data.models;
  if (req.query.series_id) models = models.filter(m => m.series_id == req.query.series_id);
  res.json(models.slice().sort((a, b) => a.name.localeCompare(b.name, 'zh')));
});

app.post('/api/models', (req, res) => {
  const { series_id, name } = req.body;
  if (!series_id || !name) return res.status(400).json({ error: '参数不完整' });
  const data = loadData();
  const m = { id: data.nextId.models++, series_id: Number(series_id), name };
  data.models.push(m);
  saveData(data);
  res.json(m);
});

app.put('/api/models/:id', (req, res) => {
  const { name } = req.body;
  const data = loadData();
  const m = data.models.find(x => x.id == req.params.id);
  if (!m) return res.status(404).json({ error: '车型不存在' });
  m.name = name;
  saveData(data);
  res.json({ success: true });
});

app.delete('/api/models/:id', (req, res) => {
  const data = loadData();
  const idx = data.models.findIndex(m => m.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: '车型不存在' });
  data.models.splice(idx, 1);
  data.cars = data.cars.filter(c => c.model_id != req.params.id);
  saveData(data);
  res.json({ success: true });
});

// ========== 车辆 API ==========
function enrichCar(c, data) {
  const brand = data.brands.find(b => b.id === c.brand_id);
  const series = data.series.find(s => s.id === c.series_id);
  const model = data.models.find(m => m.id === c.model_id);
  return { ...c, brand_name: brand ? brand.name : '', series_name: series ? series.name : '', model_name: model ? model.name : '' };
}

app.get('/api/cars', (req, res) => {
  const data = loadData();
  let cars = data.cars.filter(c => c.status === 1);
  if (req.query.brand_id) cars = cars.filter(c => c.brand_id == req.query.brand_id);
  if (req.query.series_id) cars = cars.filter(c => c.series_id == req.query.series_id);
  if (req.query.model_id) cars = cars.filter(c => c.model_id == req.query.model_id);
  if (req.query.keyword) {
    const kw = req.query.keyword;
    cars = cars.filter(c => c.title.includes(kw) || (c.description && c.description.includes(kw)));
  }
  cars.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(cars.map(c => enrichCar(c, data)));
});

app.get('/api/cars/all', (req, res) => {
  const data = loadData();
  const cars = data.cars.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(cars.map(c => enrichCar(c, data)));
});

app.get('/api/cars/:id', (req, res) => {
  const data = loadData();
  const car = data.cars.find(c => c.id == req.params.id);
  if (!car) return res.status(404).json({ error: '车辆不存在' });
  res.json(enrichCar(car, data));
});

app.post('/api/cars', (req, res) => {
  const { brand_id, series_id, model_id, title, price, year, mileage, color, fuel, transmission, description, images, contact_name, contact_phone } = req.body;
  if (!brand_id || !series_id || !model_id || !title || !price) {
    return res.status(400).json({ error: '必填项不完整' });
  }
  const data = loadData();
  const car = {
    id: data.nextId.cars++,
    brand_id: Number(brand_id),
    series_id: Number(series_id),
    model_id: Number(model_id),
    title, price: Number(price),
    year: year || null, mileage: mileage || null,
    color: color || '', fuel: fuel || '', transmission: transmission || '',
    description: description || '', images: images || '',
    contact_name: contact_name || '', contact_phone: contact_phone || '',
    status: 1,
    created_at: new Date().toISOString()
  };
  data.cars.push(car);
  saveData(data);
  res.json({ id: car.id });
});

app.put('/api/cars/:id', (req, res) => {
  const data = loadData();
  const car = data.cars.find(c => c.id == req.params.id);
  if (!car) return res.status(404).json({ error: '车辆不存在' });
  const { brand_id, series_id, model_id, title, price, year, mileage, color, fuel, transmission, description, images, contact_name, contact_phone, status } = req.body;
  Object.assign(car, {
    brand_id: Number(brand_id), series_id: Number(series_id), model_id: Number(model_id),
    title, price: Number(price), year: year || null, mileage: mileage || null,
    color: color || '', fuel: fuel || '', transmission: transmission || '',
    description: description || '', images: images || '',
    contact_name: contact_name || '', contact_phone: contact_phone || '',
    status: status ?? 1
  });
  saveData(data);
  res.json({ success: true });
});

app.delete('/api/cars/:id', (req, res) => {
  const data = loadData();
  const idx = data.cars.findIndex(c => c.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: '车辆不存在' });
  data.cars.splice(idx, 1);
  saveData(data);
  res.json({ success: true });
});

// 图片上传
app.post('/api/upload', upload.array('images', 10), (req, res) => {
  const urls = req.files.map(f => '/uploads/' + f.filename);
  res.json({ urls });
});

// 首页
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.listen(PORT, () => {
  console.log(`车辆售卖网站已启动: http://localhost:${PORT}`);
  console.log(`管理后台: http://localhost:${PORT}/admin`);
});
