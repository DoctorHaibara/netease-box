# netease-box

<p align="center">
  <img src="https://github.com/zonemeen/netease-box/assets/44596995/1d916d97-3635-4772-afcc-00f9d5353c1e">
  <h2 align="center">Netease Box</h2>
  <p align="center">将你的网易云音乐听歌记录更新到 Gist</p>
</p>

> 📌✨ 更多像这样的 Pinned Gist 项目请访问：https://github.com/matchai/awesome-pinned-gists

> 灵感来自于 [@jacc's music-box](https://github.com/jacc/music-box)

<!-- netease-box:start -->
⏰ 上次更新时间：2026-09-20 22:05 UTC
🎵 本周 Top 5：
[Thriller (Louis La Roche Dub Mix)] - Louis La Roche/Michael Jackson
[春天] - 张敬轩
[Heal the World] - Michael Jackson
[Catch a Grenade (The Hooligans Remix)] - Bruno Mars
[不要说你不知道] - 古巨基
<!-- netease-box:end -->

## 🎒 前置工作

1. 创建一个公开的 Github Gist (https://gist.github.com)

2. 创建一个 GitHub Token，需要勾选 `gist` 权限，复制生成的 Token (https://github.com/settings/tokens/new)

3. 获取网易云音乐用户 ID (https://music.163.com)

    - ID 为个人主页页面（`https://music.163.com/#/user/home?id=xxx`），`id` 后紧跟的那串数字
    
    ![user_id](https://user-images.githubusercontent.com/44596995/200237164-bf3b1c62-b2ee-4569-b5bf-bda06b09db08.png)

## 🚀 安装

1. Fork 这个仓库

2. 进入 Fork 后的仓库，启用 Github Actions

3. 编辑 `.github/workflows/netease-box.yml` 文件中的环境变量：

    - **GIST_ID**: `id` 是新建 Gist 的 `url` 后缀: `https://gist.github.com/zonemeen/f802683988594e7369f6c2c5e23286eb`

    - **ACCOUNT_ID**: 网易云音乐用户 `id`

    - **SONG_TYPE**: 歌曲排行类型，默认为 `1`，代表最近一周的听歌排行；输入 `0` 代表所有时间的听歌排行

4. 在项目的 `Settings > Secrets` 中创建 Github Token 变量 `GH_TOKEN`，填入到 `.github/workflows/netease-box.yml` 文件中的环境变量

5. [在个人资料中嵌入 Gist](https://docs.github.com/en/github/setting-up-and-managing-your-github-profile/pinning-items-to-your-profile)

## 📄 开源协议

本项目使用 [MIT](./LICENSE) 协议
