import { Request, Response } from "express"
import fetch from "node-fetch"
import {
  Filter,
  FilterWithCount,
  Offer,
  OffersResponse,
  PublicQueryResult,
  QuestionFilter,
  QuestionType,
} from "./types"

async function fetchDataFromContember() {
  const response = await fetch(process.env.CONTEMBER_CONTENT_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.CONTEMBER_ADMIN_TOKEN}`,
    },
    body: JSON.stringify({
      query: `{
					offerTypes: listOfferType(orderBy: [{ order: asc }]) {
						id
						name
						infoText
						needsVerification

						questions {
							id
							question
							type
							required
							options {
								id
								value
								label
								requireSpecification
							}
						}
					}

					languages: listLanguage(orderBy: [{ order: asc }]) {
						id
						name
					}

					districts: listDistrict(orderBy: [{name: asc}]) {
						id
						name

						region {
							id
							name
						}
					}

					offers: listOffer(
						filter: {
							exhausted: { eq: false }
							status: { type: { isNull: true } }
							isDeleted: { eq: false }
							volunteer: {
								verified: { eq: true }
								banned: { eq: false }
							}
						}
						orderBy: { volunteer: { createdAt: desc } }
					) {
						id
						code
						type {
							id
						}
						assignees { id }
						parameters (
							filter: {
								question: {
									public: { eq: true }
								}
							}
							orderBy: [{ question: { order: asc } }]
						) {
							id
							question {
								id
							}
							value
							specification
							values {
								id
								value
								specification
							}
						}
					}
				}
				`,
    }),
  })

  const json = (await response.json()) as any
  const data = json.data as PublicQueryResult & { offers: OffersResponse }

  const offers: Offer[] = data.offers.map((offer) => {
    const offerType = data.offerTypes.find((it) => it.id === offer.type.id)!
    return {
      id: offer.id,
      code: offer.code,
      type: offer.type,
      parameters: offer.parameters,
      allowReaction: !offerType.needsVerification,
    }
  })

  return {
    ...data,
    offers,
  }
}

type ContemberData = Awaited<ReturnType<typeof fetchDataFromContember>>
let data: ContemberData | null = null
let expiresAt: number = 0
let requestInFlight: Promise<ContemberData> | null = null

async function fetchDataFromContemberCached() {
  if (expiresAt < Date.now() && requestInFlight === null) {
    console.log("starting to fetch data from contember")
    requestInFlight = fetchDataFromContember()
    requestInFlight.then(
      (newData) => {
        console.log("OK")
        requestInFlight = null
        data = newData
        expiresAt = Date.now() + 60 * 1000
      },
      (err) => {
        console.log(err)
        requestInFlight = null
      }
    )
  }

  return data ?? (await requestInFlight!)
}

export const fetchOffersData = async (req: Request, res: Response) => {
  const data = await fetchDataFromContemberCached()
  const { offers, offerTypes, districts } = data as PublicQueryResult & { offers: Offer[] }
  const { typeFilter, questionFilter, showAllFilters, showLimit } = req.body

  const questions = Object.fromEntries(offerTypes.flatMap((it) => it.questions).map((it) => [it.id, it]))

  const filterOffers = <T extends Offer>(base: T[], filter: QuestionFilter): T[] => {
    return base.filter((offer) => {
      return Object.entries(filter).every(([questionId, options]) => {
        if (options.length === 0) {
          return true
        }
        const parameter = offer.parameters.find((it) => it.question.id === questionId)
        const values = [
          ...(parameter?.values || []).map((it) => it.value),
          ...(parameter?.value ? [parameter.value] : []),
        ]
        const question = questions[questionId]
        const valueIds =
          question.type !== "district"
            ? values.map((it) => question.options.find((option) => option.value === it)?.id)
            : values.map((it) => districts.find((district) => district.name === it)?.id)
        return options.some((optionId) => valueIds.includes(optionId))
      })
    })
  }

  const typeFilteredOffers = offers.filter((offer) => {
    if (typeFilter === null) {
      return true
    }
    return offer.type.id === typeFilter
  })

  const availableTypes = offers.reduce<{ [name: string]: number }>((acc, offer) => {
    if (offer.type.id in acc) {
      acc[offer.type.id]++
    } else {
      acc[offer.type.id] = 1
    }
    return acc
  }, {})

  const filters = (() => {
    if (typeFilter === null) {
      return []
    }

    const offerType = offerTypes.find((it) => it.id === typeFilter)!

    return offerType.questions
      .filter((it) => ["checkbox", "radio", "district"].includes(it.type))
      .map((question): Filter => {
        if (question.type === "district") {
          return {
            id: question.id,
            type: question.type as QuestionType,
            question: question.question,
            optionGroups: Object.entries(
              districts.reduce<{ [regionId: string]: { options: string[]; label: string } }>(
                (acc, district) => {
                  return {
                    ...acc,
                    [district.region.id]: {
                      label: district.region.name,
                      options: [...(acc[district.region.id]?.options ?? []), district.id],
                    },
                  }
                },
                {}
              )
            ).map(([id, { options, label }]) => ({
              id,
              label,
              options,
            })),
            options: districts.map((it) => ({
              id: it.id,
              label: it.name,
            })),
          }
        } else {
          return {
            id: question.id,
            type: question.type as QuestionType,
            question: question.question,
            options: question.options.map((it) => ({
              id: it.id,
              label: it.label,
            })),
          }
        }
      })
      .map((question): FilterWithCount => {
        const optionGroups = question.optionGroups
          ?.map((option) => ({
            ...option,
            count: filterOffers(typeFilteredOffers, { [question.id]: option.options }).length,
          }))
          .filter((it) => it.count > 0)
        optionGroups?.sort((a, b) => b.count - a.count)

        const options = question.options
          .map((option) => {
            return {
              ...option,
              count: filterOffers(typeFilteredOffers, { [question.id]: [option.id] }).length,
            }
          })
          .filter((it) => it.count > 0)
        options.sort((a, b) => b.count - a.count)
        return {
          ...question,
          optionGroups,
          options,
        }
      })
      .filter((it) => it.options.length > 0)
  })()

  const totalOfferCount = offers.length
  const filteredOffers = filterOffers(typeFilteredOffers, questionFilter)
  const lessFilters = filters.filter((it) => it.type === "district")
  const additionalFilters = filters.filter((it) => !lessFilters.includes(it))
  const shownFilters = showAllFilters ? [...lessFilters, ...additionalFilters] : lessFilters
  const offersToShow = filteredOffers.filter((it) => it.parameters.length > 0).slice(0, showLimit)
  const offersToShowTotalCount = filteredOffers.filter((it) => it.parameters.length > 0).length

  res.json({
    totalOfferCount,
    availableTypes,
    filters,
    lessFilters,
    shownFilters,
    offerTypes,
    offersToShow,
    offersToShowTotalCount,
  })
}
