import { VestingScheduleBuilder } from '@/components/VestingScheduleBuilder'

export default function VestingPage() {
  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">⏳ Token Vesting</h1>
      <p className="text-gray-400 mb-8">
        Create cliff + linear vesting schedules for team members, advisors, and investors.
      </p>
      <VestingScheduleBuilder />
    </div>
  )
}
