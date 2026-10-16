type Props = React.InputHTMLAttributes<HTMLInputElement> & { label?: string }

export default function Input({ label, className = '', ...p }: Props) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <input
        {...p}
        className={`border border-gray-300 rounded-lg px-3 py-2 focus:outline-none
          focus:ring-2 focus:ring-orange-400 ${className}`}
      />
    </div>
  )
}
