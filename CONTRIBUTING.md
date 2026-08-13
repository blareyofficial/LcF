# Contributing to LcF

Thank you for your interest in contributing to the Lossless Compression Format project! This document provides guidelines and instructions for contributing.

## 📋 Code of Conduct

We are committed to providing a welcoming and inspiring community for all. Please read and follow our principles:

- Be respectful and inclusive
- Focus on constructive criticism
- Help others learn and grow
- Report issues appropriately

## 🚀 Getting Started

### Prerequisites

- Node.js 14+ (for JavaScript development)
- Python 3.8+ (for Python tooling)
- Git

### Setup Development Environment

```bash
# Clone the repository
git clone https://github.com/lcf-format/lcf.git
cd lcf

# Install Node.js dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt
```

### Build & Test

```bash
# Run tests
node tests/test.js

# Python CLI test
python tools/lcf-cli.py inspect --help

# Build documentation
# (if applicable)
```

---

## 📝 Types of Contributions

### 🐛 Bug Reports

Found a bug? Please report it!

**Before submitting:**
- Check if the issue already exists
- Try to reproduce with the latest code
- Collect relevant information

**Submit issue with:**
- Clear title describing the bug
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node/Python version)
- Relevant error messages or logs

```markdown
**Title:** Decoder fails on PNG with transparency

**Steps to Reproduce:**
1. Encode transparent PNG: `python lcf-cli.py encode test.png test.lcf`
2. Decode back: `python lcf-cli.py decode test.lcf output.png`
3. Compare alpha channel

**Expected:** Alpha channel preserved exactly
**Actual:** Alpha channel is corrupted

**Environment:**
- OS: Ubuntu 22.04
- Python 3.10
- Pillow 9.0
```

### ✨ Feature Requests

Want to suggest an enhancement?

**Before requesting:**
- Check if feature already exists
- Verify it aligns with LcF goals
- Consider implementation complexity

**Request format:**
- Clear description of feature
- Use case and motivation
- Proposed API/interface
- Potential implementation approach

### 💻 Code Contributions

### Proposing Changes

For significant changes:
1. Open an issue first to discuss
2. Get feedback from maintainers
3. Proceed with implementation

### Code Style

#### JavaScript

```javascript
/**
 * JSDoc comment for functions
 * @param {type} param - Description
 * @returns {type} Description
 */
function myFunction(param) {
  // Use clear variable names
  const result = processData(param);
  
  // Add comments for complex logic
  if (condition) {
    // Explanation
    doSomething();
  }
  
  return result;
}

// Formatting
// - Use 2-space indentation
// - Avoid single-letter variables
// - Use const by default
// - Meaningful function names
```

#### Python

```python
"""Module docstring"""

def my_function(param):
    """
    Function docstring.
    
    Args:
        param: Description
        
    Returns:
        Description of return value
    """
    # Use snake_case for variables
    result = process_data(param)
    
    # Clear variable names
    if condition:
        # Explanation for complex logic
        do_something()
    
    return result

# Formatting
# - Follow PEP 8
# - Use 4-space indentation
# - Type hints where helpful
```

### Commit Messages

Write clear, descriptive commit messages:

```
Short summary (50 chars max)

More detailed explanation of the change, if needed.
Explain the problem and the solution.

- Use bullet points for multiple changes
- Reference issues: Fixes #123
- Keep paragraphs wrapped at 72 chars
```

Examples:

```
Add adaptive filter selection algorithm

Implements entropy-based selection of predictor filters
per scanline for improved compression ratios.

- Calculates entropy for each filter type
- Selects filter with minimum entropy
- Reduces average file size by 8-12%

Fixes #42
```

### Pull Requests

1. **Fork** the repository
2. **Create branch**: `git checkout -b feature/description`
3. **Make changes** and commit
4. **Push** to your fork
5. **Open PR** with detailed description

**PR Template:**

```markdown
## Description
Brief description of changes

## Related Issues
Fixes #123

## Changes
- Change 1
- Change 2

## Testing
How to test these changes:

## Checklist
- [ ] Tests pass
- [ ] Documentation updated
- [ ] Code follows style guide
- [ ] Commit messages are clear
```

---

## 🧪 Testing

### Running Tests

```bash
# JavaScript tests
node tests/test.js

# Python CLI tests (manual)
python tools/lcf-cli.py encode test.png test.lcf
python tools/lcf-cli.py decode test.lcf output.png
python tools/lcf-cli.py inspect test.lcf
```

### Adding Tests

For new features, add tests:

```javascript
// In tests/test.js

describe('New Feature', () => {
  it('should do something', () => {
    const result = myNewFunction();
    assert.equal(result, expected);
  });
  
  it('should handle edge cases', () => {
    assert.throws(() => myNewFunction(null), /Error message/);
  });
});
```

### Performance Testing

For performance-sensitive changes:

```bash
# Time encoding
time python tools/lcf-cli.py encode large.png large.lcf

# Profile with time
time node tests/test.js

# Memory usage
node --max-old-space-size=4096 tests/test.js
```

---

## 📚 Documentation

### Updating Docs

- **Specification**: Update [spec/lcf-spec.md](spec/lcf-spec.md) for format changes
- **API docs**: Add JSDoc/docstrings for new functions
- **Examples**: Add example usage in [examples/README.md](examples/README.md)
- **README**: Update [README.md](README.md) for major changes

### Writing Good Documentation

- Be clear and concise
- Include examples
- Explain the "why", not just the "what"
- Link to related documentation
- Keep examples runnable

---

## 🔍 Areas for Contribution

### High Priority

1. **Performance Optimization**
   - SIMD filter acceleration
   - Faster entropy compression
   - Memory-efficient decoding

2. **Cross-Platform Support**
   - C++ implementation
   - Rust implementation
   - WASM for browsers

3. **Quality Assurance**
   - Additional test cases
   - Fuzz testing
   - Compression benchmarks

### Medium Priority

1. **Features**
   - Vector layer rendering
   - Animation playback
   - HDR color space support

2. **Tooling**
   - GUI encoder/decoder
   - ImageMagick plugin
   - FFmpeg integration

3. **Documentation**
   - Tutorials and guides
   - Implementation guide
   - API reference

### Lower Priority

1. **Neural Compression**
   - ML-based codec research
   - Integration with PyTorch/TensorFlow

2. **Advanced Features**
   - Streaming support
   - Parallel encoding
   - GPU acceleration

---

## ✅ Review Process

When you submit a PR:

1. **Automated Checks** run (linting, tests)
2. **Code Review** from maintainers
3. **Feedback & Discussion** (if needed)
4. **Approval & Merge**

### Code Review Checklist

- ✅ Code follows style guide
- ✅ Tests pass and cover changes
- ✅ Documentation is updated
- ✅ Commits are clear and logical
- ✅ No breaking changes (unless major release)
- ✅ Performance impact considered

---

## 🎓 Learning Resources

### LcF Internals

- [Binary Specification](spec/lcf-spec.md) — Complete format details
- [Filter Algorithms](encoder/filters.js) — Predictive filter implementation
- [Entropy Coding](encoder/entropy.js) — Compression techniques
- [Container Format](encoder/container.js) — File structure

### Related Formats

- **PNG**: Pioneered predictive filters
- **JPEG XL**: Modern compression techniques
- **WebP**: Efficient container format
- **HEIF**: Flexible media container

### Compression Theory

- Predictive coding techniques
- Huffman coding
- Entropy coding
- Transform coding

---

## 🚀 Release Process

For maintainers:

1. Update version numbers
2. Update CHANGELOG
3. Create release tag
4. Publish to npm/PyPI
5. Create GitHub release

---

## 📞 Questions?

- **Issues**: Ask on GitHub Issues
- **Discussions**: Join GitHub Discussions
- **Email**: See project contacts

---

## 🙏 Thank You!

We appreciate all contributions, from code to documentation to bug reports. Together we're building a better, more open image format!

---

**Last Updated:** 2026-08-13  
**License:** GPL-3.0
