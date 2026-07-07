import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ApiError } from '@/lib/api'
import { GenerateReportButton } from '@/components/report/GenerateReportButton'

const mockPush = jest.fn()
const mockGenerate = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('@/lib/useReportApi', () => ({
  useReportApi: () => ({ generate: mockGenerate }),
}))

beforeEach(() => {
  mockPush.mockReset()
  mockGenerate.mockReset()
})

describe('GenerateReportButton', () => {
  it('generates and navigates to the report on success', async () => {
    mockGenerate.mockResolvedValue({ token: 'tok-xyz', reportId: 'PV-CA-2026-0001', narratedByAi: true })
    render(<GenerateReportButton checkId="check-1" />)

    fireEvent.click(screen.getByRole('button', { name: /get readiness report/i }))

    await waitFor(() => expect(mockGenerate).toHaveBeenCalledWith('check-1'))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/report/tok-xyz'))
  })

  it('shows an upgrade prompt on 403 (unpaid)', async () => {
    mockGenerate.mockRejectedValue(new ApiError('A paid plan is required.', 403))
    render(<GenerateReportButton checkId="check-1" />)

    fireEvent.click(screen.getByRole('button', { name: /get readiness report/i }))

    await waitFor(() => expect(screen.getByText(/available on a paid plan/i)).toBeInTheDocument())
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('shows a generic error otherwise', async () => {
    mockGenerate.mockRejectedValue(new ApiError('Failed (500)', 500))
    render(<GenerateReportButton checkId="check-1" />)

    fireEvent.click(screen.getByRole('button', { name: /get readiness report/i }))

    await waitFor(() => expect(screen.getByText(/failed \(500\)/i)).toBeInTheDocument())
  })
})
