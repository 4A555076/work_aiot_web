
export default function BaseStatus({ tag = "gray", text }) {
  const variants = {
    green: {
      container: "bg-green-50 text-green-700 border border-green-200",
      dot: "bg-green-500",
    },

    blue: {
      container: "bg-sky-50 text-sky-700 border border-sky-200",
      dot: "bg-sky-500",
    },

    amber: {
      container: "bg-amber-50 text-amber-700 border border-amber-200",
      dot: "bg-amber-500",
    },

    orange: {
      container: "bg-orange-50 text-orange-700 border border-orange-200",
      dot: "bg-orange-500",
    },

    red: {
      container: "bg-red-50 text-red-700 border border-red-200",
      dot: "bg-red-500",
    },


    gray: {
      container: "bg-gray-50 text-gray-600 border border-gray-200",
      dot: "bg-gray-400",
    },
  };

  const style = variants[tag] ?? variants.gray;

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 ${style.container}`}>
      <span className={`h-2 w-2 rounded-full ${style.dot}`} />
      {text}
    </span>
  )
}