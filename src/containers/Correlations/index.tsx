import React, { useState, useEffect, useRef, useMemo } from 'react'
import { IResponseCGMarketsAPI } from '~/api/types'
import {
	Body,
	ButtonCell,
	Cell,
	HeaderCell,
	Row,
	SearchRow,
	SelectedBody,
	Table,
	Image,
	SearchBody,
	Add,
	Description
} from './styles'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRouter } from 'next/router'
import { FAQ } from './Faq'
import { usePriceCharts } from './hooks'
import { pearsonCorrelationCoefficient } from './util'
import { Icon } from '~/components/Icon'
import { Dialog, DialogDismiss, useDialogState } from 'ariakit'

export function CoinsPicker({ coinsData, dialogState, selectCoin, selectedCoins, queryCoins }: any) {
	const parentRef = useRef()
	const [search, setSearch] = useState('')
	const filteredCoins = useMemo(() => {
		return (
			coinsData &&
			coinsData.filter(
				(coin) =>
					(search === ''
						? true
						: coin?.symbol?.toLowerCase().includes(search.toLowerCase()) ||
						  coin?.name?.toLowerCase().includes(search.toLowerCase())) && !selectedCoins[coin.id]
			)
		)
	}, [search, selectedCoins, queryCoins])
	const rowVirtualizer = useVirtualizer({
		count: filteredCoins?.length || 0,
		getScrollElement: () => parentRef.current,
		estimateSize: () => 50
	})
	return (
		<Dialog state={dialogState} className="dialog flex flex-col items-center sm:max-w-[340px]">
			<span className="flex items-center gap-1 w-full">
				<input
					value={search}
					onChange={(e) => {
						setSearch(e.target?.value)
					}}
					placeholder="Search token..."
					className="bg-white dark:bg-black rounded-md py-2 px-3 flex-1"
					autoFocus
				/>
				<DialogDismiss>
					<Icon name="x" height={24} width={24} />
					<span className="sr-only">Close dialog</span>
				</DialogDismiss>
			</span>

			<SearchBody
				ref={parentRef}
				style={{
					height: 400,
					width: 300,
					overflowY: 'auto',
					contain: 'strict'
				}}
			>
				<div
					style={{
						height: `${rowVirtualizer.getTotalSize()}px`,
						width: '100%',
						position: 'relative'
					}}
				>
					{rowVirtualizer.getVirtualItems().map((virtualItem) => {
						const coin = filteredCoins[virtualItem.index]

						if (!coin) return

						return (
							<SearchRow
								style={{
									position: 'absolute',
									top: 0,
									left: 0,
									width: '100%',
									height: `${virtualItem.size}px`,
									transform: `translateY(${virtualItem.start}px)`
								}}
								key={virtualItem.key}
								onClick={() => selectCoin(coin)}
							>
								<Image
									alt={''}
									src={coin.image}
									height={'24px'}
									width={'24px'}
									loading="lazy"
									onError={(e) => {
										e.currentTarget.src = '/placeholder.png'
									}}
								/>
								<span>
									{coin.name} ({coin.symbol.toUpperCase()})
								</span>
							</SearchRow>
						)
					})}
				</div>
			</SearchBody>
		</Dialog>
	)
}

export default function Correlations({ coinsData }) {
	const router = useRouter()
	const queryCoins = router.query?.coin || ([] as Array<string>)
	const selectedCoins = useMemo<Record<string, IResponseCGMarketsAPI>>(
		() =>
			(queryCoins &&
				Object.fromEntries(
					coinsData
						.filter((coin) =>
							Array.isArray(queryCoins) ? queryCoins.find((c) => c === coin.id) : coin.id === queryCoins
						)
						.map((coin) => [coin.id, coin])
				)) ||
			{},
		[queryCoins]
	)
	const [period, setPeriod] = useState(365)
	const { data: priceChart, isLoading } = usePriceCharts(Object.keys(selectedCoins))
	const coins = Object.values(selectedCoins).filter(Boolean)
	const correlations = useMemo(
		() =>
			!isLoading
				? Object.fromEntries(
						coins.map((coin0) => {
							const results = coins.map((coin1) => {
								if (coin1.id === coin0.id) return null
								const chart0 = priceChart[coin0.id]?.slice(-period)
								const chart1 = priceChart[coin1.id]?.slice(-period)
								const shortChartLength = chart0.length > chart1?.length ? chart1?.length : chart0?.length
								const corr = pearsonCorrelationCoefficient(
									chart0.slice(0, shortChartLength),
									chart1.slice(0, shortChartLength)
								)
								return corr
							})
							return [coin0.id, results]
						})
				  )
				: [],
		[isLoading, period, queryCoins]
	)

	useEffect(() => {
		if (!queryCoins?.length)
			router.push(
				{
					pathname: router.pathname,
					query: {
						...router.query,
						coin: ['bitcoin', 'ethereum', 'tether', 'binancecoin']
					}
				},
				undefined,
				{ shallow: true }
			)
	}, [queryCoins, router])

	const dialogState = useDialogState()

	return (
		<>
			<h1 className="text-2xl font-medium">Correlations Matrix</h1>

			<div className="flex items-center flex-nowrap overflow-hidden relative mx-auto p-1 text-[var(--text1)] bg-[var(--bg6)] rounded-lg font-medium">
				<button
					className="flex-1 px-6 py-2 data-[active=true]:bg-[#445ed0] rounded-lg"
					onClick={() => setPeriod(7)}
					data-active={period === 7}
				>
					7d
				</button>
				<button
					className="flex-1 px-6 py-2 data-[active=true]:bg-[#445ed0] rounded-lg"
					onClick={() => setPeriod(30)}
					data-active={period === 30}
				>
					1m
				</button>
				<button
					className="flex-1 px-6 py-2 data-[active=true]:bg-[#445ed0] rounded-lg"
					onClick={() => setPeriod(365)}
					data-active={period === 365}
				>
					1y
				</button>
			</div>

			<Body>
				<SelectedBody>
					<h2 className="text-lg font-medium">Selected Coins</h2>
					{Object.values(selectedCoins).map((coin) =>
						coin ? (
							<SearchRow
								key={coin.symbol.toUpperCase()}
								onClick={() =>
									router.push(
										{
											pathname: router.pathname,
											query: {
												...router.query,
												coin: Array.isArray(queryCoins) ? queryCoins.filter((c) => c !== coin.id) : []
											}
										},
										undefined,
										{ shallow: true }
									)
								}
							>
								<Image
									alt={''}
									src={coin.image}
									height={'24px'}
									width={'24px'}
									loading="lazy"
									onError={(e) => {
										e.currentTarget.src = '/placeholder.png'
									}}
								/>
								<span>{coin.symbol.toUpperCase()}</span>
								<Icon name="x" height={14} width={14} />
							</SearchRow>
						) : null
					)}
					<Add onClick={dialogState.toggle}>
						<div>+</div>
					</Add>
				</SelectedBody>
				<Table>
					<thead>
						<th />
						{coins.map((coin) => (
							<HeaderCell key={coin.id}>{coin?.symbol?.toUpperCase()}</HeaderCell>
						))}
						<ButtonCell onClick={dialogState.toggle}>+</ButtonCell>
					</thead>
					<tbody>
						{coins.map((coin, i) => (
							<Row key={coin.id + i + period}>
								<HeaderCell>{coin?.symbol?.toUpperCase()}</HeaderCell>
								{correlations[coin.id]?.map((corr) =>
									corr === null ? (
										<Image
											key={coin.image}
											alt={''}
											src={coin.image}
											height={'24px'}
											width={'24px'}
											style={{ marginTop: '13px' }}
											loading="lazy"
											onError={(e) => {
												e.currentTarget.src = '/placeholder.png'
											}}
										/>
									) : (
										<Cell value={Number(corr)} key={corr + coin.id + period}>
											{corr}
										</Cell>
									)
								)}
							</Row>
						))}
						<Row>
							<ButtonCell onClick={() => dialogState.toggle}>+</ButtonCell>
						</Row>
					</tbody>
				</Table>
				<CoinsPicker
					coinsData={coinsData}
					dialogState={dialogState}
					selectedCoins={selectedCoins}
					queryCoins={queryCoins}
					selectCoin={(coin) => {
						router.push(
							{
								pathname: router.pathname,
								query: {
									...router.query,
									coin: Array.isArray(queryCoins) ? queryCoins.concat(coin.id) : [queryCoins, coin.id]
								}
							},
							undefined,
							{ shallow: true }
						)
					}}
				/>
			</Body>
			<Description>
				Correlation is calculated by using each day as a single data point, and this calculation depends on the selected
				period. For example, if you select a period of one year, the correlation will be computed from 365 data points.
			</Description>
			<FAQ />
		</>
	)
}
