type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'danger' | 'ghost' | 'success'
  loading?: boolean
}

const variants = {
  primary: 'bg-orange-500 text-white hover:bg-orange-600',
  danger:  'bg-red-500 text-white hover:bg-red-600',
  ghost:   'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
  success: 'bg-green-500 text-white hover:bg-green-600'
}

export default function Btn({ variant = 'primary', loading, children, className = '', disabled, ...p }: Props) {
  return (
    <button
      {...p}
      disabled={disabled || loading}
      className={`px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]} ${className}`}
    >
      {loading ? 'Загрузка...' : children}
    </button>
  )
}
