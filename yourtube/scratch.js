const fs = require('fs');

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

let replaced = false;

files.forEach(f => {
  if(fs.existsSync(f)) {
    let c = fs.readFileSync(f, 'utf8');
    
    // Replace `/${(video?.filepath || "").replace(/\\\\/g, "/")}`
    c = c.replace(/src=\{\`\/\$\{\(video\?\.filepath \|\| ""\)\.replace\(\/\\\\\\\\\/g, "\\\/"\)\}\`\}/g, 
        'src={`\\${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"}/${(video?.filepath || "").replace(/\\\\/g, "/")}`}');
        
    // Replace `/${(item.videoid?.filepath || "").replace(/\\\\/g, "/")}`
    c = c.replace(/src=\{\`\/\$\{\(item\.videoid\?\.filepath \|\| ""\)\.replace\(\/\\\\\\\\\/g, "\\\/"\)\}\`\}/g, 
        'src={`\\${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"}/${(item.videoid?.filepath || "").replace(/\\\\/g, "/")}`}');
        
    // Replace const videoUrl = `/${(video?.filepath || "").replace(/\\\\/g, "/")}`;
    c = c.replace(/const videoUrl = \`\/\$\{\(video\?\.filepath \|\| ""\)\.replace\(\/\\\\\\\\\/g, "\\\/"\)\}\`;/g, 
        'const videoUrl = `\\${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"}/${(video?.filepath || "").replace(/\\\\/g, "/")}`;');

    if(fs.readFileSync(f, 'utf8') !== c) {
        fs.writeFileSync(f, c);
        replaced = true;
    }
  }
});
console.log(replaced ? 'Successfully replaced' : 'No replacements made');
