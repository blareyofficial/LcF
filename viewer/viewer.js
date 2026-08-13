/**
 * LcF Web Viewer
 * Browser-based viewer for LcF image files
 */

class LcfViewer {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.currentImage = null;
    this.zoomLevel = 1;
    this.panX = 0;
    this.panY = 0;
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };

    this.initializeElements();
    this.attachEventListeners();
  }

  initializeElements() {
    this.fileInput = document.getElementById('fileInput');
    this.uploadArea = document.getElementById('uploadArea');
    this.selectButton = document.getElementById('selectButton');
    this.infoPanel = document.getElementById('infoPanel');
    this.metadataSection = document.getElementById('metadataSection');
    this.metadataPanel = document.getElementById('metadataPanel');
    this.animationSection = document.getElementById('animationSection');
    this.statsPanel = document.getElementById('statsPanel');

    this.zoomInBtn = document.getElementById('zoomInBtn');
    this.zoomOutBtn = document.getElementById('zoomOutBtn');
    this.resetZoomBtn = document.getElementById('resetZoomBtn');

    this.exportPngBtn = document.getElementById('exportPngBtn');
    this.exportJpegBtn = document.getElementById('exportJpegBtn');
    this.exportJsonBtn = document.getElementById('exportJsonBtn');
    this.downloadLcfBtn = document.getElementById('downloadLcfBtn');

    this.playBtn = document.getElementById('playBtn');
    this.pauseBtn = document.getElementById('pauseBtn');
    this.frameSlider = document.getElementById('frameSlider');
    this.frameCounter = document.getElementById('frameCounter');
  }

  attachEventListeners() {
    // Upload area
    this.selectButton.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

    // Drag and drop
    this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
    this.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
    this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));

    // Zoom controls
    this.zoomInBtn.addEventListener('click', () => this.zoom(1.2));
    this.zoomOutBtn.addEventListener('click', () => this.zoom(0.8));
    this.resetZoomBtn.addEventListener('click', () => this.resetZoom());

    // Canvas panning
    this.canvas.addEventListener('mousedown', (e) => this.startPan(e));
    this.canvas.addEventListener('mousemove', (e) => this.pan(e));
    this.canvas.addEventListener('mouseup', (e) => this.endPan(e));
    this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));

    // Export buttons
    this.exportPngBtn.addEventListener('click', () => this.exportPng());
    this.exportJpegBtn.addEventListener('click', () => this.exportJpeg());
    this.exportJsonBtn.addEventListener('click', () => this.exportJson());
    this.downloadLcfBtn.addEventListener('click', () => this.downloadLcf());

    // Animation controls
    this.playBtn.addEventListener('click', () => this.playAnimation());
    this.pauseBtn.addEventListener('click', () => this.pauseAnimation());
    this.frameSlider.addEventListener('input', (e) => this.setFrame(e.target.value));
  }

  handleFileSelect(event) {
    const files = event.target.files;
    if (files.length > 0) {
      this.loadFile(files[0]);
    }
  }

  handleDragOver(event) {
    event.preventDefault();
    this.uploadArea.classList.add('dragover');
  }

  handleDragLeave(event) {
    event.preventDefault();
    this.uploadArea.classList.remove('dragover');
  }

  handleDrop(event) {
    event.preventDefault();
    this.uploadArea.classList.remove('dragover');

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      this.loadFile(files[0]);
    }
  }

  async loadFile(file) {
    const startTime = performance.now();
    const fileSize = (file.size / 1024).toFixed(2);

    try {
      this.selectButton.disabled = true;
      this.selectButton.textContent = 'Loading...';

      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      if (file.name.endsWith('.lcf')) {
        await this.loadLcf(data);
      } else if (file.name.endsWith('.png') || file.name.endsWith('.jpg') || file.name.endsWith('.jpeg')) {
        await this.loadImage(file);
      } else {
        this.showError('Unsupported file format');
        return;
      }

      const endTime = performance.now();
      const decodeTime = ((endTime - startTime) / 1000).toFixed(3);

      // Update stats
      document.getElementById('fileSize').textContent = `${fileSize} KB`;
      document.getElementById('decodeTime').textContent = `${decodeTime}s`;

      if (this.currentImage) {
        const uncompressed = this.currentImage.width * this.currentImage.height * 4;
        const ratio = (uncompressed / file.size).toFixed(2);
        document.getElementById('compressionRatio').textContent = `${ratio}:1`;
      }
    } catch (error) {
      this.showError(`Failed to load file: ${error.message}`);
    } finally {
      this.selectButton.disabled = false;
      this.selectButton.textContent = 'Select File';
    }
  }

  async loadLcf(data) {
    try {
      // Send binary LCF data to server for decoding
      const response = await fetch('/api/decode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: data
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const decoded = await response.json();
      const { width, height, channels, data: pixelData } = decoded;

      // Create image data
      this.canvas.width = width;
      this.canvas.height = height;

      const imageData = this.ctx.createImageData(width, height);
      imageData.data.set(pixelData);
      this.ctx.putImageData(imageData, 0, 0);

      this.currentImage = {
        width,
        height,
        imageData
      };

      this.resetZoom();
      this.updateInfoPanel();
      this.enableExportButtons();
      this.showSuccess(`Decoded LCF (${width}×${height})`);
    } catch (error) {
      this.showError(`Failed to decode LCF: ${error.message}`);
    }
  }

  async loadImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Draw to canvas
          this.canvas.width = img.width;
          this.canvas.height = img.height;
          this.ctx.drawImage(img, 0, 0);

          this.currentImage = {
            width: img.width,
            height: img.height,
            imageData: this.ctx.getImageData(0, 0, img.width, img.height)
          };

          this.resetZoom();
          this.updateInfoPanel();
          this.enableExportButtons();
          this.showSuccess(`Loaded ${file.name} (${img.width}×${img.height})`);

          resolve();
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  updateInfoPanel() {
    if (!this.currentImage) {
      this.infoPanel.textContent = 'No image loaded';
      return;
    }

    const info = `
Dimensions: ${this.currentImage.width}×${this.currentImage.height} pixels
File Size: ${(this.currentImage.width * this.currentImage.height * 4 / 1024).toFixed(2)} KB
Bit Depth: 32-bit (RGBA)
Color Space: sRGB
Zoom Level: ${(this.zoomLevel * 100).toFixed(1)}%
Pan Offset: (${this.panX.toFixed(0)}, ${this.panY.toFixed(0)})
    `.trim();

    this.infoPanel.textContent = info;
  }

  enableExportButtons() {
    this.exportPngBtn.disabled = false;
    this.exportJsonBtn.disabled = false;
    this.downloadLcfBtn.disabled = false;
  }

  exportPng() {
    if (!this.currentImage) return;

    const link = document.createElement('a');
    link.href = this.canvas.toDataURL('image/png');
    link.download = 'exported.png';
    link.click();

    this.showSuccess('PNG exported successfully');
  }

  exportJpeg() {
    if (!this.currentImage) return;

    const link = document.createElement('a');
    link.href = this.canvas.toDataURL('image/jpeg', 0.95);
    link.download = 'exported.jpg';
    link.click();

    this.showSuccess('JPEG exported successfully');
  }

  exportJson() {
    if (!this.currentImage) return;

    const json = {
      width: this.currentImage.width,
      height: this.currentImage.height,
      channels: 4,
      colorSpace: 'sRGB',
      bitDepth: 8,
      data: Array.from(this.currentImage.imageData.data)
    };

    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'exported.json';
    link.click();

    this.showSuccess('JSON exported successfully');
  }

  async downloadLcf() {
    if (!this.currentImage) return;

    try {
      this.downloadLcfBtn.disabled = true;
      this.downloadLcfBtn.textContent = 'Encoding...';

      const payload = {
        width: this.currentImage.width,
        height: this.currentImage.height,
        channels: 4,
        bitDepth: 8,
        colorSpace: 0,
        data: Array.from(this.currentImage.imageData.data)
      };

      const response = await fetch('/api/encode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'exported.lcf';
      link.click();

      this.showSuccess('LCF file downloaded successfully');
    } catch (error) {
      this.showError(`Failed to encode LCF: ${error.message}`);
    } finally {
      this.downloadLcfBtn.disabled = false;
      this.downloadLcfBtn.textContent = 'Download as LCF';
    }
  }

  zoom(factor) {
    this.zoomLevel *= factor;
    this.zoomLevel = Math.max(0.1, Math.min(10, this.zoomLevel));
    this.render();
  }

  resetZoom() {
    this.zoomLevel = 1;
    this.panX = 0;
    this.panY = 0;
    this.render();
    this.updateInfoPanel();
  }

  startPan(event) {
    this.isDragging = true;
    this.dragStart = { x: event.clientX, y: event.clientY };
  }

  pan(event) {
    if (!this.isDragging) return;

    const dx = event.clientX - this.dragStart.x;
    const dy = event.clientY - this.dragStart.y;

    this.panX += dx;
    this.panY += dy;

    this.dragStart = { x: event.clientX, y: event.clientY };
    this.render();
  }

  endPan() {
    this.isDragging = false;
    this.updateInfoPanel();
  }

  handleWheel(event) {
    event.preventDefault();
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    this.zoom(factor);
  }

  render() {
    if (!this.currentImage) {
      this.ctx.fillStyle = '#f5f5f5';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    this.ctx.translate(centerX + this.panX, centerY + this.panY);
    this.ctx.scale(this.zoomLevel, this.zoomLevel);
    this.ctx.translate(-this.currentImage.width / 2, -this.currentImage.height / 2);

    this.ctx.putImageData(this.currentImage.imageData, 0, 0);
    this.ctx.restore();
  }

  playAnimation() {
    this.showError('Animation support requires LcF decoder');
  }

  pauseAnimation() {
    // TODO
  }

  setFrame(frameIndex) {
    // TODO
  }

  showError(message) {
    const msgEl = document.createElement('div');
    msgEl.className = 'error-message';
    msgEl.textContent = message;
    document.querySelector('main').insertBefore(msgEl, document.querySelector('main').firstChild);

    setTimeout(() => msgEl.remove(), 5000);
  }

  showSuccess(message) {
    const msgEl = document.createElement('div');
    msgEl.className = 'success-message';
    msgEl.textContent = message;
    document.querySelector('main').insertBefore(msgEl, document.querySelector('main').firstChild);

    setTimeout(() => msgEl.remove(), 5000);
  }
}

// Initialize viewer on page load
document.addEventListener('DOMContentLoaded', () => {
  new LcfViewer();
  console.log('[Viewer] LcF Viewer initialized');
});
