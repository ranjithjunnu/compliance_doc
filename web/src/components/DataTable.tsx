// The one table used across Aegis: sortable columns, search and pages.
// Today the sorting, search and paging happen in the browser. When lists get large,
// the backend will do them instead (manual mode) and this component stays the same.
import { useState, type ReactNode } from 'react'
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
} from '@tanstack/react-table'
import { EmptyState } from './ui'

export const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString },
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
})

export const columnHelper = <T extends RowData>() => createColumnHelper<typeof features, T>()

export function DataTable<T extends RowData>({
  data,
  columns,
  searchLabel = 'Search',
  emptyTitle = 'Nothing here yet',
  emptyBody,
  pageSize = 25,
  onRowClick,
  toolbar,
}: {
  data: T[]
  // Each column holds a different value type, so the value type is left open here.
  columns: ColumnDef<typeof features, T, any>[]
  searchLabel?: string
  emptyTitle?: string
  emptyBody?: ReactNode
  pageSize?: number
  onRowClick?: (row: T) => void
  toolbar?: ReactNode
}) {
  const [initialState] = useState({ pagination: { pageIndex: 0, pageSize } })
  const table = useTable({
    features,
    columns,
    data,
    initialState,
    globalFilterFn: 'includesString',
  })

  const { pageIndex, pageSize: size } = table.state.pagination
  const total = table.getPrePaginatedRowModel().rows.length
  const first = total === 0 ? 0 : pageIndex * size + 1
  const last = Math.min(total, (pageIndex + 1) * size)
  const rows = table.getRowModel().rows

  return (
    <div className="table-wrap">
      <div className="table-toolbar">
        <label className="search">
          <span className="visually-hidden">{searchLabel}</span>
          <input
            className="input input-search"
            type="search"
            placeholder={searchLabel}
            value={String(table.state.globalFilter ?? '')}
            onChange={(e) => table.setGlobalFilter(e.target.value)}
          />
        </label>
        {toolbar}
      </div>
      <div className="table-scroll">
        <table className="table">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted()
                  const canSort = header.column.getCanSort()
                  return (
                    <th
                      key={header.id}
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button type="button" className="th-sort" onClick={header.column.getToggleSortingHandler()}>
                          <table.FlexRender header={header} />
                          <span className="th-sort-icon" aria-hidden="true">
                            {sorted === 'asc' ? '↑' : sorted === 'desc' ? '↓' : '↕'}
                          </span>
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={onRowClick ? 'row-clickable' : undefined}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === 'Enter') onRowClick(row.original)
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
              >
                {row.getAllCells().map((cell) => (
                  <td key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <EmptyState title={emptyTitle}>{emptyBody}</EmptyState> : null}
      </div>
      <div className="table-footer">
        <span className="muted">
          {total === 0 ? 'No rows' : `${first}–${last} of ${total}`}
        </span>
        <div className="table-pager">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
