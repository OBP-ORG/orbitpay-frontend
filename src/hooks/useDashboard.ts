"use client"

import { useState, useEffect } from "react"
import {
    fetchDashboardMetrics,
    fetchRecentActivity,
    type DashboardMetrics,
    type ActivityItem,
} from "@/lib/orbitpay"

interface DashboardState {
    metrics: DashboardMetrics
    activity: ActivityItem[]
    loading: boolean
    error: string | null
    refresh: () => void
}

const DEFAULT_METRICS: DashboardMetrics = {
    treasuryBalance: "0 XLM",
    activeStreams: 0,
    vestingSchedules: 0,
    activeProposals: 0,
    employees: 0,
}

async function loadDashboard(
    address: string | null,
    setMetrics: (m: DashboardMetrics) => void,
    setActivity: (a: ActivityItem[]) => void,
    setLoading: (l: boolean) => void,
    setError: (e: string | null) => void,
) {
    setLoading(true)
    setError(null)
    try {
        const [m, a] = await Promise.all([
            fetchDashboardMetrics(address),
            fetchRecentActivity(address),
        ])
        setMetrics(m)
        setActivity(a)
    } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load dashboard data")
    } finally {
        setLoading(false)
    }
}

export function useDashboard(address: string | null): DashboardState {
    const [metrics, setMetrics] = useState<DashboardMetrics>(DEFAULT_METRICS)
    const [activity, setActivity] = useState<ActivityItem[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        void loadDashboard(address, setMetrics, setActivity, setLoading, setError)
    }, [address])

    return {
        metrics,
        activity,
        loading,
        error,
        refresh: () =>
            loadDashboard(address, setMetrics, setActivity, setLoading, setError),
    }
}