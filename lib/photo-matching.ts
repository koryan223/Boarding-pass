export interface StudentMatch {
  uin: string
  first_name: string
  last_name: string
  confidence: "high" | "medium" | "low"
  matchType: "uin" | "name" | "fuzzy"
}

export function extractUINFromFilename(filename: string): string | null {
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "")

  // Pattern 1: Exact 2-9 digit UIN (most common)
  const exactUINMatch = nameWithoutExt.match(/\b\d{2,9}\b/)
  if (exactUINMatch) {
    return exactUINMatch[0]
  }

  // Pattern 2: Any 2-9 digit sequence (less strict)
  const anyDigits = nameWithoutExt.match(/\d{2,9}/)
  if (anyDigits) {
    return anyDigits[0]
  }

  return null
}

export function extractNameFromFilename(filename: string): { firstName?: string; lastName?: string } {
  // Remove file extension and UIN if present
  let nameWithoutExt = filename.replace(/\.[^/.]+$/, "")
  nameWithoutExt = nameWithoutExt.replace(/\b\d{2,9}\b/, "").trim()

  // Remove common separators and clean up
  nameWithoutExt = nameWithoutExt.replace(/[-_]+/g, " ").trim()

  // Split by spaces and filter out empty strings
  const nameParts = nameWithoutExt.split(/\s+/).filter((part) => part.length > 0)

  if (nameParts.length >= 2) {
    return {
      firstName: nameParts[0],
      lastName: nameParts[nameParts.length - 1],
    }
  } else if (nameParts.length === 1) {
    return {
      firstName: nameParts[0],
    }
  }

  return {}
}

export function findStudentMatch(
  filename: string,
  students: Array<{ uin: string; first_name: string; last_name: string }>,
): StudentMatch | null {
  // Try UIN matching first (highest confidence)
  const uin = extractUINFromFilename(filename)
  if (uin) {
    const student = students.find((s) => s.uin === uin)
    if (student) {
      return {
        ...student,
        confidence: "high",
        matchType: "uin",
      }
    }
  }

  // Try name matching (medium confidence)
  const { firstName, lastName } = extractNameFromFilename(filename)
  if (firstName || lastName) {
    // Exact name match
    const exactMatch = students.find((s) => {
      const firstMatch = firstName ? s.first_name.toLowerCase() === firstName.toLowerCase() : true
      const lastMatch = lastName ? s.last_name.toLowerCase() === lastName.toLowerCase() : true
      return firstMatch && lastMatch
    })

    if (exactMatch) {
      return {
        ...exactMatch,
        confidence: "medium",
        matchType: "name",
      }
    }

    // Fuzzy name matching (low confidence)
    const fuzzyMatch = students.find((s) => {
      if (firstName && lastName) {
        const firstSimilar = calculateSimilarity(s.first_name.toLowerCase(), firstName.toLowerCase()) > 0.8
        const lastSimilar = calculateSimilarity(s.last_name.toLowerCase(), lastName.toLowerCase()) > 0.8
        return firstSimilar && lastSimilar
      } else if (firstName) {
        return calculateSimilarity(s.first_name.toLowerCase(), firstName.toLowerCase()) > 0.9
      } else if (lastName) {
        return calculateSimilarity(s.last_name.toLowerCase(), lastName.toLowerCase()) > 0.9
      }
      return false
    })

    if (fuzzyMatch) {
      return {
        ...fuzzyMatch,
        confidence: "low",
        matchType: "fuzzy",
      }
    }
  }

  return null
}

function calculateSimilarity(str1: string, str2: string): number {
  const len1 = str1.length
  const len2 = str2.length

  if (len1 === 0) return len2 === 0 ? 1 : 0
  if (len2 === 0) return 0

  const matrix = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(null))

  for (let i = 0; i <= len1; i++) matrix[i][0] = i
  for (let j = 0; j <= len2; j++) matrix[0][j] = j

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost, // substitution
      )
    }
  }

  const maxLen = Math.max(len1, len2)
  return (maxLen - matrix[len1][len2]) / maxLen
}

export function validatePhotoFilename(filename: string): {
  isValid: boolean
  issues: string[]
  suggestions: string[]
} {
  const issues: string[] = []
  const suggestions: string[] = []

  // Check file extension
  const validExtensions = [".jpg", ".jpeg", ".png", ".webp"]
  const hasValidExtension = validExtensions.some((ext) => filename.toLowerCase().endsWith(ext))

  if (!hasValidExtension) {
    issues.push("Invalid file extension")
    suggestions.push("Use .jpg, .png, or .webp format")
  }

  // Check for UIN
  const uin = extractUINFromFilename(filename)
  if (!uin) {
    issues.push("No UIN found in filename")
    suggestions.push('Include 2-9 digit UIN in filename (e.g., "12345.jpg")')
  }

  // Check for name components
  const { firstName, lastName } = extractNameFromFilename(filename)
  if (!firstName && !lastName && !uin) {
    issues.push("No identifiable information found")
    suggestions.push("Include either UIN or student name in filename")
  }

  return {
    isValid: issues.length === 0,
    issues,
    suggestions,
  }
}
