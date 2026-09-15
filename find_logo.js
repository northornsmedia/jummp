const fs = require('fs');
const path = require('path');

function searchDir(dir, list = []) {
  try {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const full = path.join(dir, f);
      try {
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          if (!full.includes('node_modules') && !full.includes('.git') && !full.includes('.next')) {
            searchDir(full, list);
          }
        } else if (/\.(png|jpg|jpeg|webp)$/i.test(f)) {
          list.push({ path: full, mtime: stat.mtimeMs, size: stat.size });
        }
      } catch (e) {}
    }
  } catch (e) {}
  return list;
}

const res = searchDir('C:\\Users\\User\\.gemini');
res.sort((a, b) => b.mtime - a.mtime);
console.log('Top 10 recent images in .gemini:');
for (const item of res.slice(0, 10)) {
  console.log(item.path, item.size, new Date(item.mtime).toISOString());
}
