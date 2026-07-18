require('dotenv').config()
const axios = require('axios')
const crypto = require('crypto')
const { Octokit } = require('@octokit/rest')

// ======== NetEase weapi encryption constants ========
// RSA public key (from NetEase's core JS file)
const MODULUS =
  '00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7'
const PUB_EXP = '010001'
const FIXED_KEY = '0CoJUm6Qyw8W8jud' // First-round AES key
const IV = '0102030405060708'

const {
  GIST_ID: gistId,
  GH_TOKEN: githubToken,
  ACCOUNT_ID: accountId,
  SONG_TYPE: type = 1,
} = process.env

console.log('Environment Variables:')
console.log('GIST_ID:', gistId)
console.log('GH_TOKEN:', githubToken ? '***' : 'Not Set')
console.log('ACCOUNT_ID:', accountId)
console.log('SONG_TYPE:', type)

// ======== Encryption helpers ========

/** AES-128-CBC encryption */
const aesEncrypt = (key, text) => {
  const cipher = crypto.createCipheriv('AES-128-CBC', key, IV)
  return cipher.update(text, 'utf-8', 'base64') + cipher.final('base64')
}

/** Generate random 16-character string (alphanumeric) */
const generateRandomKey = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let key = ''
  for (let i = 0; i < 16; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return key
}

/** Fast modular exponentiation for BigInt */
const modPow = (base, exp, mod) => {
  let result = 1n
  base = base % mod
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod
    exp >>= 1n
    base = (base * base) % mod
  }
  return result
}

/** RSA textbook encryption (no padding) — encrypts reversed text */
const rsaEncrypt = (text, exponent, modulus) => {
  const reversed = text.split('').reverse().join('')
  const hex = Buffer.from(reversed, 'utf-8').toString('hex')
  const m = BigInt('0x' + hex)
  const e = BigInt('0x' + exponent)
  const n = BigInt('0x' + modulus)
  const c = modPow(m, e, n)
  return c.toString(16).padStart(256, '0')
}

/**
 * Build weapi encrypted request body.
 * Protocol: params = AES(randomKey, AES(fixedKey, JSON(data)))
 *           encSecKey = RSA(reverse(randomKey))
 */
const weapiEncrypt = (data) => {
  const json = JSON.stringify(data)
  const randomKey = generateRandomKey()
  const params = aesEncrypt(randomKey, aesEncrypt(FIXED_KEY, json))
  const encSecKey = rsaEncrypt(randomKey, PUB_EXP, MODULUS)
  console.log('  [weapi] randomKey:', randomKey)
  console.log('  [weapi] encSecKey:', encSecKey.slice(0, 32) + '...')
  return { params, encSecKey }
}

// ======== Main ========

;(async () => {
  try {
    // 1. Fetch play record from NetEase
    const requestBody = weapiEncrypt({ uid: accountId, type })
    console.log('\nCalling NetEase API: /weapi/v1/play/record')

    const { data } = await axios.post(
      'https://music.163.com/weapi/v1/play/record?csrf_token=',
      new URLSearchParams(requestBody).toString(),
      {
        headers: {
          Accept: '*/*',
          'Accept-Encoding': 'gzip,deflate,sdch',
          'Accept-Language': 'zh-CN,en-US;q=0.7,en;q=0.3',
          Connection: 'keep-alive',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          Host: 'music.163.com',
          Referer: 'https://music.163.com/',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      }
    )

    // Log full response for debugging
    console.log('\nNetEase API Response:')
    console.log('  code:', data.code)
    console.log('  message:', data.message)
    console.log('  has weekData:', !!data.weekData)
    console.log('  has allData:', !!data.allData)
    if (data.weekData) {
      console.log('  weekData length:', data.weekData.length)
      console.log('  first entry:', JSON.stringify(data.weekData[0]))
    }

    // 2. Check response code
    if (data.code !== 200) {
      console.error(`\n⚠️  NetEase API returned code ${data.code}: ${data.message}`)
      console.error('Full response:', JSON.stringify(data))
      return
    }

    // 3. Extract songs (weekData for weekly, allData for all-time)
    const songs = data.weekData ?? data.allData
    if (!songs || !songs.length) {
      console.log('No songs found in response')
      return
    }

    // 4. Format top 5 tracks
    const tracks = songs
      .slice(0, 5)
      .map(({ song }) => `[${song.name}] - ${song.ar.map(({ name }) => name).join('/')}`)
      .join('\n')

    console.log('\nTop 5 tracks:\n', tracks)

    // 5. Update Gist
    const octokit = new Octokit({ auth: `${githubToken}` })

    let gist
    try {
      gist = await octokit.gists.get({ gist_id: gistId })
    } catch (error) {
      console.error(`\nFailed to get Gist:\n${error}`)
      return
    }

    const filename = Object.keys(gist.data.files)[0]
    console.log('Gist filename:', filename)

    await octokit.request('PATCH /gists/{gist_id}', {
      gist_id: gistId,
      description: '🎵 My NetEase Cloud Music weekly top tracks',
      files: {
        '🎵 My NetEase Cloud Music Top Track': {
          content: tracks,
        },
      },
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })

    console.log('\n✅ Gist updated successfully!')
  } catch (error) {
    if (error.response) {
      console.error('\n❌ HTTP Error:')
      console.error('  Status:', error.response.status)
      console.error('  Data:', JSON.stringify(error.response.data))
    } else {
      console.error('\n❌ Unable to update gist:', error.message)
      console.error(error)
    }
  }
})()
