const fs = require('fs');
const files = ['1.mp4', '2.mp4'];
let m3u8 = "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:65\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-PLAYLIST-TYPE:VOD\n";
files.forEach(f => { m3u8 += `#EXTINF:60.000,\n${f}\n`; });
m3u8 += "#EXT-X-ENDLIST\n";
console.log(m3u8);
