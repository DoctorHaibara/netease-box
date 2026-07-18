/**
 * Test script for NetEase weapi encryption.
 * Run: node test.js
 *
 * Tests that the encryption produces valid params/encSecKey
 * and optionally makes a real API call if ACCOUNT_ID is set.
 */
const crypto = require('crypto')

// ======== Constants ========
const MODULUS =
  '00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7'
const PUB_EXP = '010001'
const FIXED_KEY = '0CoJUm6Qyw8W8jud'
const IV = '0102030405060708'

// ======== Encryption helpers ========
const aesEncrypt = (key, text) => {
  const cipher = crypto.createCipheriv('AES-128-CBC', key, IV)
  return cipher.update(text, 'utf-8', 'base64') + cipher.final('base64')
}

const aesDecrypt = (key, encrypted) => {
  const decipher = crypto.createDecipheriv('AES-128-CBC', key, IV)
  return decipher.update(encrypted, 'base64', 'utf-8') + decipher.final('utf-8')
}

const generateRandomKey = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let key = ''
  for (let i = 0; i < 16; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return key
}

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

const rsaEncrypt = (text, exponent, modulus) => {
  const reversed = text.split('').reverse().join('')
  const hex = Buffer.from(reversed, 'utf-8').toString('hex')
  const m = BigInt('0x' + hex)
  const e = BigInt('0x' + exponent)
  const n = BigInt('0x' + modulus)
  const c = modPow(m, e, n)
  return c.toString(16).padStart(256, '0')
}

const weapiEncrypt = (data) => {
  const json = JSON.stringify(data)
  const randomKey = generateRandomKey()
  const params = aesEncrypt(randomKey, aesEncrypt(FIXED_KEY, json))
  const encSecKey = rsaEncrypt(randomKey, PUB_EXP, MODULUS)
  return { params, encSecKey }
}

// ======== Self-test: verify encryption is reversible ========
console.log('=== Self-test: Encryption Verification ===\n')

// Test AES only
const testData = JSON.stringify({ uid: '123456', type: 1 })
const randomKey = generateRandomKey()
const encrypted = aesEncrypt(randomKey, aesEncrypt(FIXED_KEY, testData))
const decrypted = aesDecrypt(FIXED_KEY, aesDecrypt(randomKey, encrypted))
console.log('AES round-trip:', testData === decrypted ? '✅ PASS' : '❌ FAIL')
if (testData !== decrypted) {
  console.log('  Expected:', testData)
  console.log('  Got:', decrypted)
}

// Test RSA (verify encSecKey format and consistency)
const encSecKey = rsaEncrypt(randomKey, PUB_EXP, MODULUS)
console.log('encSecKey length:', encSecKey.length, encSecKey.length === 256 ? '✅ PASS' : '❌ FAIL (expected 256)')
console.log('encSecKey hex:', encSecKey.match(/^[0-9a-f]+$/) ? '✅ PASS' : '❌ FAIL (non-hex chars)')

// Test that same input produces different output each time (random key)
const result1 = weapiEncrypt({ uid: '123456', type: 1 })
const result2 = weapiEncrypt({ uid: '123456', type: 1 })
console.log('Random keys differ:', result1.params !== result2.params ? '✅ PASS' : '❌ FAIL')
console.log('encSecKeys differ:', result1.encSecKey !== result2.encSecKey ? '✅ PASS' : '❌ FAIL')

// Print sample output
console.log('\nSample weapi output:')
console.log('  randomKey:', randomKey)
console.log('  params (first 80 chars):', result1.params.slice(0, 80) + '...')
console.log('  encSecKey (first 32 chars):', result1.encSecKey.slice(0, 32) + '...')

// ======== API Call Test ========
const ACCOUNT_ID = process.env.ACCOUNT_ID || '1504809469'

console.log('\n=== API Call Test ===')
console.log('Testing with uid:', ACCOUNT_ID, 'type: 1 (weekly)\n')

const axios = require('axios')

;(async () => {
  try {
    const requestBody = weapiEncrypt({ uid: ACCOUNT_ID, type: 1 })

    console.log('Sending POST to music.163.com/weapi/v1/play/record ...')
    const { data, status } = await axios.post(
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
        timeout: 15000,
      }
    )

    console.log('HTTP Status:', status)
    console.log('Response code:', data.code)
    console.log('Response message:', data.message)

    if (data.code === 200) {
      console.log('\n✅ API call successful!')
      if (data.weekData && data.weekData.length > 0) {
        console.log(`\nWeekly report (${data.weekData.length} songs):`)
        data.weekData.slice(0, 10).forEach((entry, i) => {
          const s = entry.song
          const artists = s.ar.map(a => a.name).join('/')
          console.log(`  ${i + 1}. ${s.name} - ${artists} (plays: ${entry.playCount})`)
        })
      } else if (data.allData && data.allData.length > 0) {
        console.log(`\nNo weekly data, showing all-time (${data.allData.length} songs):`)
        data.allData.slice(0, 10).forEach((entry, i) => {
          const s = entry.song
          const artists = s.ar.map(a => a.name).join('/')
          console.log(`  ${i + 1}. ${s.name} - ${artists} (plays: ${entry.playCount})`)
        })
      } else {
        console.log('⚠️  API returned code 200 but no data found')
        console.log('This could mean:')
        console.log('  - The user has set listening history to private')
        console.log('  - Need a valid MUSIC_U cookie for authentication')
        console.log('  - The uid is incorrect')
      }
    } else if (data.code === 301 || data.code === -2) {
      console.log('\n❌ Authentication required!')
      console.log('This endpoint needs a valid login session.')
      console.log('You need to set a valid MUSIC_U cookie to access play records.')
    } else {
      console.log('\n❌ API returned non-200 code')
      console.log('Full response:', JSON.stringify(data, null, 2))
    }
  } catch (error) {
    if (error.response) {
      console.error('HTTP Error:', error.response.status)
      console.error('Response:', JSON.stringify(error.response.data))
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      console.error('Network error:', error.message)
    } else {
      console.error('Error:', error.message)
    }
  }
})()
