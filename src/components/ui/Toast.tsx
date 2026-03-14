import toast, { Toaster } from 'react-hot-toast'
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react'

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#1E293B',
          color: '#F8FAFC',
          border: '1px solid #334155',
          borderRadius: '12px',
          fontSize: '14px',
        },
      }}
    />
  )
}

export const notify = {
  success: (message: string) =>
    toast(message, { icon: <CheckCircle className="h-5 w-5 text-success" /> }),
  error: (message: string) =>
    toast(message, { icon: <XCircle className="h-5 w-5 text-danger" />, duration: 6000 }),
  warning: (message: string) =>
    toast(message, { icon: <AlertTriangle className="h-5 w-5 text-warning" /> }),
  info: (message: string) =>
    toast(message, { icon: <Info className="h-5 w-5 text-blue-400" /> }),
}
