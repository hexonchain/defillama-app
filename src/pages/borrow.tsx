import * as React from 'react'
import Layout from '~/layout'
import { Announcement } from '~/components/Announcement'
import { disclaimer, findOptimizerPools } from '~/containers/YieldsPage/utils'
import { getAllCGTokensList, maxAgeForNext } from '~/api'
import { getLendBorrowData } from '~/api/categories/yield'
import { withPerformanceLogging } from '~/utils/perf'
import styled from 'styled-components'
import { useSelectState, SelectArrow, Select, SelectPopover, SelectItem } from 'ariakit/select'
import { useSetPopoverStyles } from '~/components/Popover/utils'
import { Combobox, ComboboxList, useComboboxState } from 'ariakit/combobox'
import { useRouter } from 'next/router'
import { TokenLogo } from '~/components/TokenLogo'
import { Tab, TabList } from '~/components'
import { chainIconUrl, tokenIconUrl } from '~/utils'

export const getStaticProps = withPerformanceLogging('borrow', async () => {
	const {
		props: { pools, ...data }
	} = await getLendBorrowData()

	let cgList = await getAllCGTokensList()
	const cgTokens = cgList.filter((x) => x.symbol)
	const cgPositions = cgList.reduce((acc, e, i) => ({ ...acc, [e.symbol]: i }), {} as any)
	const searchData = {
		['USD_STABLES']: {
			name: `All USD Stablecoins`,
			symbol: 'USD_STABLES'
		}
	}

	data.symbols
		.sort((a, b) => cgPositions[a] - cgPositions[b])
		.forEach((sRaw) => {
			const s = sRaw.replaceAll(/\(.*\)/g, '').trim()

			const cgToken = cgTokens.find((x) => x.symbol === sRaw.toLowerCase() || x.symbol === s.toLowerCase())

			searchData[s] = {
				name: s,
				symbol: s
			}
		})

	return {
		props: {
			// lend & borrow from query are uppercase only. symbols in pools are mixed case though -> without
			// setting to uppercase, we only show subset of available pools when applying `findOptimzerPools`
			pools: pools.filter((p) => p.category !== 'CDP').map((p) => ({ ...p, symbol: p.symbol.toUpperCase() })),
			cdpPools: pools
				.filter((p) => p.category === 'CDP' && p.mintedCoin)
				.map((p) => ({ ...p, chains: [p.chain], borrow: { ...p, symbol: p.mintedCoin.toUpperCase() } })),
			searchData
		},
		revalidate: maxAgeForNext([23])
	}
})

export default function YieldBorrow(data) {
	const router = useRouter()

	const includeIncentives = router.query['incentives'] === 'true'

	const borrowToken = router.query['borrow']
		? typeof router.query['borrow'] === 'string'
			? (router.query['borrow'] as string)
			: router.query['borrow'][0]
		: null

	const collateralToken = router.query['collateral']
		? typeof router.query['collateral'] === 'string'
			? (router.query['collateral'] as string)
			: router.query['collateral'][0]
		: null

	const filteredPools = findOptimizerPools({
		pools: data.pools,
		tokenToLend: collateralToken,
		tokenToBorrow: borrowToken,
		cdpRoutes: data.cdpPools
	})

	return (
		<Layout title={`Borrow Aggregator - DefiLlama`} defaultSEO>
			<Announcement>{disclaimer}</Announcement>
			<Wrapper>
				<FormWrapper>
					<label>
						<span data-label>Borrow</span>
						<TokensSelect searchData={data.searchData} query={'borrow'} placeholder="Select token to borrow" />
					</label>

					<label>
						<span data-label>Collateral</span>
						<TokensSelect searchData={data.searchData} query={'collateral'} placeholder="Select token for collateral" />
						{borrowToken && !collateralToken ? (
							<small>Select your collateral token to see real borrow cost!</small>
						) : null}
					</label>

					{borrowToken || collateralToken ? (
						<label data-checkbox>
							<input
								type="checkbox"
								checked={includeIncentives}
								onChange={() =>
									router.push(
										{ pathname: router.pathname, query: { ...router.query, incentives: !includeIncentives } },
										undefined,
										{ shallow: true }
									)
								}
							/>
							<span data-label>Include Incentives</span>
						</label>
					) : null}
				</FormWrapper>
				{(borrowToken || collateralToken) && <PoolsList pools={filteredPools} />}
			</Wrapper>
		</Layout>
	)
}

const Wrapper = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 16px;

	max-width: 992px;
	margin: 0 -16px;

	@media screen and (min-width: ${({ theme: { bpSm } }) => bpSm}) {
		margin: 0 auto;
		width: 100%;
	}
`

const Content = styled.div`
	border-radius: 12px;
	background: ${({ theme }) => (theme.mode === 'dark' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(246, 246, 246, 0.6)')};
	width: 100%;
	max-width: 480px;

	display: flex;
	flex-direction: column;
	gap: 20px;
	padding: 16px;
	overflow-y: auto;
`

const FormWrapper = styled(Content)`
	label {
		display: flex;
		flex-direction: column;
		gap: 4px;

		& > *[data-label] {
			font-size: 1rem;
			font-weight: 400;
		}
	}

	label[data-checkbox] {
		cursor: pointer;
		flex-direction: row;
		margin: 0 auto;
	}

	small {
		color: orange;
		text-align: center;
		margin-top: 2px;
	}

	height: 252px;
`

const PoolsWrapper = styled(Content)`
	padding: 0px 0px 16px;

	& > *[data-emptytext] {
		text-align: center;
		margin: 16px 16px 24px;
	}
`

const TokensSelect = ({
	searchData,
	query,
	placeholder
}: {
	searchData: { [token: string]: { name: string; symbol: string; image: string; image2: string } }
	query: string
	placeholder: string
}) => {
	const [isLarge, renderCallback] = useSetPopoverStyles()

	const combobox = useComboboxState({ list: Object.keys(searchData) })
	const { value, setValue, ...selectProps } = combobox
	const router = useRouter()

	const onChange = (value) => {
		router.push({ pathname: '/borrow', query: { ...router.query, [query]: value } }, undefined, { shallow: true })
	}

	const selectedValue: string = router.query[query]
		? typeof router.query[query] === 'string'
			? (router.query[query] as string)
			: router.query[query][0]
		: ''

	const select = useSelectState({
		...selectProps,
		defaultValue: '',
		value: selectedValue,
		setValue: onChange,
		gutter: 6,
		animated: isLarge ? false : true,
		sameWidth: true,
		renderCallback
	})

	// Resets combobox value when popover is collapsed
	if (!select.mounted && combobox.value) {
		combobox.setValue('')
	}

	const focusItemRef = React.useRef(null)

	const tokenInSearchData = selectedValue !== '' ? searchData[selectedValue.toUpperCase()] : null

	const [resultsLength, setResultsLength] = React.useState(10)

	const showMoreResults = () => {
		setResultsLength((prev) => prev + 10)
	}

	return (
		<>
			<Select
				state={select}
				className="bg-[var(--btn-bg)] hover:bg-[var(--btn-hover-bg)] focus-visible:bg-[var(--btn-hover-bg)] flex items-center gap-2 p-3 text-base font-medium rounded-md cursor-pointer text-[var(--text1)] flex-nowrap"
			>
				{tokenInSearchData ? (
					<>
						<TokenLogo logo={tokenInSearchData.image2} fallbackLogo={tokenInSearchData.image} />
						<span>
							{tokenInSearchData.symbol === 'USD_STABLES' ? tokenInSearchData.name : tokenInSearchData.symbol}
						</span>
					</>
				) : (
					<span className="opacity-60">{placeholder}</span>
				)}
				<SelectArrow className="ml-auto" />
			</Select>

			{select.mounted ? (
				<SelectPopover
					state={select}
					composite={false}
					initialFocusRef={focusItemRef}
					className="flex flex-col bg-[var(--bg1)] rounded-md z-10 overflow-auto overscroll-contain min-w-[180px] max-h-[60vh] border border-[hsl(204,20%,88%)] dark:border-[hsl(204,3%,32%)] max-sm:drawer"
				>
					<Combobox
						state={combobox}
						placeholder="Search..."
						autoFocus
						className="bg-white dark:bg-black rounded-md py-2 px-3 m-3 mb-0"
					/>

					{combobox.matches.length > 0 ? (
						<ComboboxList state={combobox} className="flex flex-col overflow-auto overscroll-contain">
							{combobox.matches.slice(0, resultsLength + 1).map((value, i) => (
								<SelectItem
									value={value}
									key={value + i}
									focusOnHover
									className="flex items-center justify-between gap-4 p-3 flex-shrink-0 hover:bg-[var(--primary1-hover)] focus-visible:bg-[var(--primary1-hover)] cursor-pointer first-of-type:rounded-t-md last-of-type:rounded-b-md"
								>
									{value === 'USD_STABLES' ? searchData[value].name : `${value}`}
								</SelectItem>
							))}
						</ComboboxList>
					) : (
						<p className="text-[var(--text1)] py-6 px-3 text-center">No results found</p>
					)}

					{resultsLength < combobox.matches.length ? (
						<button
							className="text-left w-full pt-4 px-4 pb-7 text-[var(--link)] hover:bg-[var(--bg2)] focus-visible:bg-[var(--bg2)]"
							onClick={showMoreResults}
						>
							See more...
						</button>
					) : null}
				</SelectPopover>
			) : null}
		</>
	)
}

const safeProjects = [
	'AAVE',
	'AAVE V2',
	'AAVE V3',
	'AAVE V1',
	'MakerDAO',
	'Spark',
	'Compound',
	'Compound V1',
	'Compound V2',
	'Compound V3'
]

interface IPool {
	projectName: string
	totalAvailableUsd: number
	chain: string
	pool: string | null
	poolMeta: string | null
	tvlUsd: number
	borrow: any
	apyBaseBorrow?: number | null
	apyBase?: number | null
	apy?: number | null
	apyReward?: number | null
	apyRewardBorrow?: number | null
	ltv?: number | null
}

const PoolsList = ({ pools }: { pools: Array<IPool> }) => {
	const [tab, setTab] = React.useState('safe')

	const filteredPools = pools
		.filter(
			(pool) =>
				(tab === 'safe' ? safeProjects.includes(pool.projectName) : !safeProjects.includes(pool.projectName)) &&
				pool.borrow.totalAvailableUsd
		)
		.sort((a, b) => b.tvlUsd - a.tvlUsd)

	const router = useRouter()
	const { borrow, collateral, incentives } = router.query

	const filteredPools2 = {}

	filteredPools.forEach((pool) => {
		if (!filteredPools2[pool.projectName + pool.chain]) {
			filteredPools2[pool.projectName + pool.chain] = pool
		}
	})

	const finalPools: Array<IPool> = Object.values(filteredPools2)

	return (
		<PoolsWrapper>
			<TabList>
				<Tab onClick={() => setTab('safe')} aria-selected={tab === 'safe'}>
					Safe
				</Tab>
				<Tab onClick={() => setTab('degen')} aria-selected={tab === 'degen'}>
					Degen
				</Tab>
			</TabList>

			{finalPools.length === 0 ? (
				<p data-emptytext>Couldn't find any pools</p>
			) : (
				<tbody>
					<ProjectsWrapper>
						{finalPools.map((pool) => (
							<Project key={JSON.stringify(pool)}>
								<th>
									<span data-pname>
										<TokenLogo logo={tokenIconUrl(pool.projectName)} size={20} />
										<span>{pool.projectName}</span>
									</span>
								</th>

								<td>
									<span data-metric>
										<span>
											{(
												(borrow && collateral
													? incentives === 'true'
														? pool.apy + pool.borrow.apyBorrow * pool.ltv
														: pool.apyBase + pool.borrow.apyBaseBorrow * pool.ltv
													: borrow
													? incentives === 'true'
														? pool.borrow.apyBorrow
														: pool.borrow.apyBaseBorrow
													: incentives === 'true'
													? pool.apy
													: pool.apyBase) ?? 0
											).toLocaleString(undefined, { maximumFractionDigits: 2 })}
											%
										</span>
										<span>{borrow && collateral ? 'Net APY' : borrow ? 'Net Borrow APY' : 'Net Supply APY'}</span>
									</span>
								</td>

								{/* <td>
									<span data-metric>
										<span>
											{pool.borrow.apyBaseBorrow && pool.ltv
												? (incentives === 'true' ? pool.borrow.apyBorrow : pool.borrow.apyBaseBorrow).toLocaleString(
														undefined,
														{ maximumFractionDigits: 2 }
												  ) + '%'
												: '-'}
										</span>
										<span>Cost</span>
									</span>
								</td>

								<td>
									<span data-metric>
										<span>{formattedNum(pool.borrow.totalAvailableUsd, true)}</span>
										<span>Available</span>
									</span>
								</td> */}

								<td>
									<span data-pname data-cname>
										<TokenLogo logo={chainIconUrl(pool.chain)} size={20} />
										<span>{pool.chain}</span>
									</span>
								</td>
							</Project>
						))}
					</ProjectsWrapper>
				</tbody>
			)}
		</PoolsWrapper>
	)
}

const ProjectsWrapper = styled.table`
	margin: -8px 16px;
	border-collapse: separate;
	border-spacing: 0 8px;
	width: calc(100% - 32px);
`

const Project = styled.tr`
	padding: 12px;

	& > *:first-child {
		border-radius: 12px 0px 0px 12px;
	}

	& > *:last-child {
		border-radius: 0px 12px 12px 0px;
	}

	th,
	td {
		font-weight: 400;
		font-size: 0.875rem;
		padding: 8px;
		background: ${({ theme }) => (theme.mode === 'dark' ? '#17181c' : '#eff0f3')};
	}

	& > * > *[data-pname] {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	& > * > *[data-cname] {
		justify-content: flex-end;
	}

	& > * > *[data-metric] {
		display: flex;
		flex-direction: column;

		& > *:last-child {
			font-size: 0.75rem;
			opacity: 0.6;
		}
	}
`
