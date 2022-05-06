type OfferResponse = {
  id: string
  code: string
  type: {
    id: string
  }
  assignees: {
    id: string
  }[]
  parameters: {
    id: string
    question: {
      id: string
    }
    value: string
    specification?: string
    values: {
      id: string
      value: string
      specification: string
    }[]
  }[]
}
export type OffersResponse = OfferResponse[]

export type Offer = {
  id: string
  code: string
  allowReaction: boolean
  type: {
    id: string
  }
  parameters: {
    id: string
    question: {
      id: string
    }
    value: string
    specification?: string
    values: {
      id: string
      value: string
      specification: string
    }[]
  }[]
}

export interface Filter {
  id: string
  type: QuestionType
  question: string
  optionGroups?: { id: string; label: string; options: string[] }[]
  options: { id: string; label: string }[]
}

export interface FilterWithCount {
  id: string
  type: QuestionType
  question: string
  optionGroups?: { id: string; label: string; options: string[]; count: number }[]
  options: { id: string; label: string; count: number }[]
}

export type QuestionFilter = { [questionId: string]: string[] }

export interface QuestionDefinition {
  id: string
  question: string
  type: QuestionType
  required: boolean
  options: {
    id: string
    value: string
    label: string
    requireSpecification: boolean
  }[]
}

export type QuestionType = "radio" | "checkbox" | "text" | "textarea" | "number" | "date" | "district"

export type Districts = {
  id: string
  name: string
  region: {
    id: string
    name: string
  }
}[]

export type Languages = {
  id: string
  name: string
}[]

export interface PublicQueryResult {
  offerTypes: {
    id: string
    name: string
    infoText: string
    questions: QuestionDefinition[]
    needsVerification: boolean
  }[]
  districts: Districts
  languages: Languages
}
