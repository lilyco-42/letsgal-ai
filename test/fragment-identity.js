import assert from 'node:assert/strict';
import {parseStory} from '../lib/story.js';
// Multiple chapters commonly compile in the same millisecond. Each branch
// target must still identify one fragment, including the first main fragment.
const previous=Date.now;Date.now=()=>42;
try{
 const story=parseStory('# 第一章\n!choice 继续 -> ending\n## ending\n旁白：第一章结局\n# 第二章\n旁白：第二章开场');
 const fragments=story.chapters.flatMap(c=>c.fragments);
 assert.equal(new Set(fragments.map(f=>f.id)).size,fragments.length);
 const option=JSON.parse(story.chapters[0].fragments[0].blocks[0].props.optionsJson)[0];
 assert.equal(option.fragmentId,story.chapters[0].fragments[1].id);
}finally{Date.now=previous}
