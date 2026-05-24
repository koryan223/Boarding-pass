/**
 * Card swipe decoder for Illinois ID cards
 * Parses raw magnetic stripe data and extracts UIN
 */

/**
 * Calculates the Luhn checksum for validation
 */
function luhnChecksum(account: string): boolean {
  let total = 0
  for (let i = 0; i < account.length; i++) {
    const digit = Number.parseInt(account[i])
    if (i % 2 === 0) {
      const value = digit * 2
      total += value <= 9 ? value : value - 9
    } else {
      total += digit
    }
  }
  return total % 10 === 0
}

/**
 * Parses raw card swipe data from Illinois ID cards
 * Format: %B6397670655365011^CARDHOLDER/UNIVERSITY^2806120?;6397670655365011=28061208303?
 * QR Code Format: 6397679776714031=29091203874 OR shorter format 639767977=29091203874
 * Returns the 9-digit UIN or null if invalid
 */
export function decodeIllinoisCard(rawData: string): string | null {
  console.log("[v0] Decoding Illinois card, data length:", rawData.length)
  console.log("[v0] Raw data:", rawData)

  // Try to match QR code format with varying lengths
  const qrMatch = rawData.match(/(63\d+)=\d+/)

  if (qrMatch && qrMatch[1]) {
    const account = qrMatch[1]
    console.log("[v0] Found QR code account:", account, "length:", account.length)

    if (account.length === 16) {
      // Full format: 6397679776714031
      // Extract UIN from positions 4-12
      const uin = account.substring(4, 13)
      console.log("[v0] Extracted UIN from full QR code:", uin)
      return uin
    } else if (account.length >= 11) {
      // Shorter format: 639767977... or 6397679776714...
      // UIN starts at position 2
      const uin = account.substring(2, 11)
      console.log("[v0] Extracted UIN from short QR code:", uin)
      return uin
    } else {
      console.log("[v0] QR code account number too short:", account.length)
    }
  }

  // Track 2 format: ;ACCOUNT=EXPIRY?
  const track2Match = rawData.match(/;(63\d{14})=/)

  if (track2Match && track2Match[1]) {
    const account = track2Match[1]
    console.log("[v0] Found Track 2 account:", account)

    // Validate using Luhn checksum
    if (luhnChecksum(account)) {
      // Extract UIN from positions 5-13 (0-indexed: 4-12)
      const uin = account.substring(4, 13)
      console.log("[v0] Extracted UIN from Track 2:", uin)
      return uin
    } else {
      console.log("[v0] Track 2 Luhn checksum failed")
    }
  }

  // Track 1 format: %B6397670655365011^CARDHOLDER/UNIVERSITY^2806120?;6397670655365011=28061208303?
  const track1Match = rawData.match(/%B(63\d{14})\^/)

  if (track1Match && track1Match[1]) {
    const account = track1Match[1]
    console.log("[v0] Found Track 1 account:", account)

    // Validate using Luhn checksum
    if (luhnChecksum(account)) {
      // Extract UIN from positions 5-13 (0-indexed: 4-12)
      const uin = account.substring(4, 13)
      console.log("[v0] Extracted UIN from Track 1:", uin)
      return uin
    } else {
      console.log("[v0] Track 1 Luhn checksum failed")
    }
  }

  console.log("[v0] No valid card data found")
  return null
}

/**
 * Detects if input contains card swipe data
 */
export function isCardSwipeData(input: string): boolean {
  return (
    input.includes("%B") || input.includes("^") || input.includes("?") || input.includes(";") || /63\d+=\d+/.test(input)
  )
}

/**
 * Processes input - either extracts UIN from card swipe or returns manual entry
 */
export function processCardInput(input: string): { uin: string | null; isCardSwipe: boolean } {
  if (isCardSwipeData(input)) {
    const uin = decodeIllinoisCard(input)
    return { uin, isCardSwipe: true }
  }

  const cleaned = input.replace(/\D/g, "")
  return {
    uin: cleaned.length >= 2 && cleaned.length <= 9 ? cleaned : null,
    isCardSwipe: false,
  }
}
