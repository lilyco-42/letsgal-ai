# 序章·梦
!curtain close dur=0
!scene 雪域 backgrounds/户外雪地.png
!particle LIGHT_SNOW particles/snow.png
!bgm bgm/雪之华.mp3 vol=45 loop
!camera zoom=1.06 dur=6000
旁白：当时间的河流缓缓流向彼方。
旁白：河边沉睡的少年，缓缓睁开双眼。
（一位短发白长裙的少女，轻轻抚摸着少年的头。）
穗(微笑)：……醒了吗？
旁白：随风飘来远方雪山的夏风。
穗(害羞)：我们还会再见的，对吧？
!wait 800
（惊醒过来）
!curtain close dur=400
!scene 房间 backgrounds/BG04033S.jpg
!curtain open dur=800

# 第一章·清晨
!bgm bgm/11.mp3 vol=40 loop
!wait 300
旁白：凌晨 6：00。
（指纹解锁）
!se se/消息提示.ogg vol=70
（手敲开QQ）
我：果然还是很想她的说……算了吧。
我：不过，她会有自己的烦恼和小幸福的，所以请迈向你的前方吧。

# 终章·三年后
!scene 路演 backgrounds/BG02323A.jpg
!curtain open dur=800
!bgm bgm/18.mp3 vol=45 loop
旁白：三年后。台下坐着曾经和我一样迷茫的人。
我：云枢智创，这个名字怎么样？
我：搜了一下，没有其他叫这个名字的。
投资人：所以为什么选你？有什么独特核心技术么？
!choice 讲 lilyco 框架 -> qa_lilyco | 讲医疗 CLI 案例 -> qa_cli

## qa_lilyco
我：我们通过 lilyco 框架，不断给政府企业开发内网安全工具。
我：lilyco 由 Rust 开发，一开始就是为解决安全、稳定、高效而生。

## qa_cli
我：我们把医院的各种医疗器械、病症系统 CLI 化，参与辅助诊断。

# 尾声
!scene 雪域 backgrounds/户外雪地.png
!particle LIGHT_SNOW particles/snow.png
!bgm bgm/雪之华.mp3 vol=45 loop
穗(微笑)：我们还会再见的，对吧？
我：嗯，一定会的。
!wait 1500
!curtain close dur=1200
!end
