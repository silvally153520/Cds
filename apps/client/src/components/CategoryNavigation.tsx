import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { propertyCategories } from '../lib/propertyCategories';

export function CategoryNavigation() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const activeCategory = searchParams.get('category') ?? searchParams.get('type') ?? '';

  const selectCategory = (type: string) => {
    const params = new URLSearchParams(location.search);
    params.delete('type');
    if (type) params.set('category', type);
    else params.delete('category');
    const query = params.toString();
    navigate({ pathname: '/explore', search: query ? `?${query}` : '' }, { preventScrollReset: true });
  };

  return (
    <nav aria-label="Danh mục chỗ nghỉ" className="border-b border-slate-100 bg-white">
      <div className="category-scroll mx-auto flex max-w-7xl items-stretch justify-start gap-2 overflow-x-auto px-4 sm:justify-center sm:px-6 lg:gap-5 lg:px-8">
        {propertyCategories.map(({ label, value, icon: Icon }) => {
          const active = activeCategory === value;
          return (
            <button
              key={value || 'all'}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => selectCategory(value)}
              className={`group relative flex min-w-[72px] shrink-0 flex-col items-center gap-1.5 px-2.5 pb-2.5 pt-3 text-[11px] font-semibold transition-colors sm:min-w-[88px] sm:pt-3.5 sm:text-xs ${
                active ? 'text-emerald-700' : 'text-slate-500 hover:text-emerald-700'
              }`}
            >
              <Icon className={`h-5 w-5 transition-transform duration-200 group-hover:-translate-y-0.5 sm:h-[21px] sm:w-[21px] ${active ? 'text-emerald-600' : ''}`} strokeWidth={active ? 2 : 1.7} />
              <span className="whitespace-nowrap">{label}</span>
              <span className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-colors ${active ? 'bg-emerald-600' : 'bg-transparent group-hover:bg-emerald-200'}`} />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
