const fs = require('fs');
const path = require('path');

const files = [
  "src/components/WatchLaterContent.tsx",
  "src/components/Videopplayer.tsx",
  "src/components/VideoInfo.tsx",
  "src/components/videocard.tsx",
  "src/components/SearchResult.tsx",
  "src/components/RelatedVideos.tsx",
  "src/components/LikedContent.tsx",
  "src/components/HistoryContent.tsx",
  "src/components/DownloadsContent.tsx"
];

const targetPatternOne = /\$\{process\.env\.NEXT_PUBLIC_BACKEND_URL \|\| "http:\/\/localhost:5000"\}\//g;

files.forEach(fileRelPath => {
    const fullPath = path.join(process.cwd(), fileRelPath);
    if (!fs.existsSync(fullPath)) {
        console.log(`File not found: ${fileRelPath}`);
        return;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    const newContent = content.replace(targetPatternOne, "/api/proxy/");
    
    if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent);
        console.log(`Reverted URL in: ${fileRelPath}`);
    } else {
        console.log(`No match in: ${fileRelPath}`);
    }
});
