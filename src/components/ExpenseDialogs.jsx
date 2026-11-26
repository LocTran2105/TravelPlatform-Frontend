import { ArrowLeft, MapPin, X, Receipt, MoreHorizontal, ChevronRight } from 'lucide-react';
import { formatVND, EXPENSE_CATEGORIES, CATEGORY_MAP } from '../utils/tripDetail';

// 4 dialog của phần Ngân sách trong TripDetail. Chỉ hiển thị: state và handler nằm ở TripDetail.

const ExpenseDialogs = ({
  expenseDialog, closeExpenseDialog, setExpenseDialog, expenseForm, updateExpenseForm,
  selectedExpenseDest, selectedExpenseCategory, expenseData, toggleSplitUser, splitShare,
  expenseError, submitExpense, isSavingExpense, allDestinations, showAllDests, setShowAllDests,
  budgetDialogOpen, isSavingBudget, setBudgetDialogOpen, budgetInput, setBudgetInput, saveBudget,
  balanceDialog, setBalanceDialog, breakdownOpen, setBreakdownOpen, categoryTotals
}) => {
  return (
    <>
      {/* ================= DIALOG THÊM CHI PHÍ ================= */}
      {expenseDialog && (
        <div
          className="fixed inset-0 z-[3000] bg-black/50 flex items-center justify-center p-4"
          onClick={closeExpenseDialog}
        >
          <div
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            {expenseDialog.step === 'item' && (
              <button
                onClick={() => setExpenseDialog({ step: 'form' })}
                aria-label="Quay lại"
                className="absolute top-4 left-4 h-8 w-8 rounded-full text-slate-600 flex items-center justify-center hover:bg-slate-100 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={closeExpenseDialog}
              aria-label="Đóng"
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {expenseDialog.step === 'form' ? (
              <>
                <h3 className="text-xl font-extrabold text-slate-900 text-center mb-6 px-8">Thêm chi phí</h3>

                {/* Số tiền */}
                <label className="flex items-center gap-3 border border-slate-300 rounded-xl px-4 py-3 mb-3 focus-within:border-slate-500 transition-colors">
                  <span className="font-bold text-slate-700">₫</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    autoFocus
                    value={expenseForm.amount}
                    onChange={(e) => updateExpenseForm({ amount: e.target.value })}
                    placeholder="0"
                    className="w-full bg-transparent outline-none text-lg font-bold text-slate-800 placeholder:text-slate-300"
                  />
                </label>

                {/* Chọn mục */}
                <button
                  type="button"
                  onClick={() => setExpenseDialog({ step: 'item' })}
                  className="w-full flex items-center gap-3 border border-slate-300 rounded-xl px-4 py-3 mb-3 text-left hover:bg-slate-50 transition-colors"
                >
                  {(() => {
                    const ItemIcon = selectedExpenseDest ? MapPin : (selectedExpenseCategory ? selectedExpenseCategory.Icon : Receipt);
                    return <ItemIcon className="w-5 h-5 text-slate-600 shrink-0" />;
                  })()}
                  <div className="min-w-0 flex-1">
                    <p className={`truncate ${selectedExpenseDest || selectedExpenseCategory ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>
                      {selectedExpenseDest ? selectedExpenseDest.placeName : (selectedExpenseCategory ? selectedExpenseCategory.label : 'Chọn mục')}
                    </p>
                    {selectedExpenseDest && (
                      <p className="text-xs text-slate-500">Danh mục: {(selectedExpenseCategory || CATEGORY_MAP.OTHER).label}</p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />
                </button>

                {/* Mô tả: hiện sau khi đã chọn mục */}
                {(selectedExpenseDest || selectedExpenseCategory) && (
                  <label className="block border border-slate-300 rounded-xl px-4 pt-2 pb-1 mb-3 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                    <span className="text-xs font-bold text-slate-900 block">Thêm mô tả</span>
                    <textarea
                      value={expenseForm.description}
                      onChange={(e) => updateExpenseForm({ description: e.target.value })}
                      maxLength={500}
                      className="w-full bg-transparent outline-none text-sm text-slate-700 resize-none h-14"
                    />
                  </label>
                )}

                {/* Trả bởi */}
                <label className="flex items-center justify-between gap-3 border border-slate-300 rounded-xl px-4 py-3 mb-3">
                  <span className="font-bold text-slate-900 shrink-0">Trả bởi</span>
                  <select
                    value={expenseForm.payerId ?? ''}
                    onChange={(e) => updateExpenseForm({ payerId: Number(e.target.value) })}
                    className="bg-transparent outline-none font-semibold text-slate-700 text-right cursor-pointer min-w-0"
                  >
                    {expenseData.members.map(m => (
                      <option key={m.userId} value={m.userId}>
                        {m.userId === expenseData.currentUserId ? `Bạn (${m.fullName})` : m.fullName}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Chia tiền */}
                <div className="border border-slate-300 rounded-xl px-4 py-3 mb-3">
                  <label className="flex items-center justify-between gap-3">
                    <span className="font-bold text-slate-900">Chia tiền</span>
                    <select
                      value={expenseForm.splitMode}
                      onChange={(e) => updateExpenseForm({ splitMode: e.target.value })}
                      className="bg-transparent outline-none font-semibold text-slate-700 text-right cursor-pointer"
                    >
                      <option value="none">Không chia</option>
                      <option value="equal">Chia đều</option>
                    </select>
                  </label>
                  {expenseForm.splitMode === 'equal' && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5">
                      {expenseData.members.map(m => {
                        const checked = expenseForm.splitUserIds.includes(m.userId);
                        return (
                          <label key={m.userId} className="flex items-center justify-between gap-3 cursor-pointer">
                            <span className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSplitUser(m.userId)}
                                className="h-4 w-4 accent-[#FF5645]"
                              />
                              <span className="truncate text-sm text-slate-700">
                                {m.userId === expenseData.currentUserId ? `Bạn (${m.fullName})` : m.fullName}
                              </span>
                            </span>
                            {checked && splitShare > 0 && (
                              <span className="text-xs font-semibold text-slate-500 shrink-0">≈ {formatVND(splitShare)}</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Ngày */}
                <label className="flex items-center justify-between gap-3 px-1 mb-5 text-sm">
                  <span className="text-slate-600"><span className="font-bold">Ngày:</span> Tùy chọn</span>
                  <input
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) => updateExpenseForm({ date: e.target.value })}
                    className="border border-slate-200 rounded-lg px-2 py-1 text-slate-700 outline-none focus:border-slate-400"
                  />
                </label>

                {expenseError && <p className="text-sm text-rose-600 font-medium mb-3 text-center">{expenseError}</p>}

                <div className="flex justify-center">
                  <button
                    onClick={submitExpense}
                    disabled={isSavingExpense}
                    className="px-14 py-3 bg-[#FF5645] text-white font-bold rounded-full hover:bg-[#E04B3B] transition-colors disabled:opacity-50"
                  >
                    {isSavingExpense ? 'Đang lưu...' : 'Lưu'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-xl font-extrabold text-slate-900 text-center mb-6 px-8">Chọn mục</h3>

                <p className="font-bold text-slate-900 mb-3">Chọn từ lịch trình của bạn</p>
                {allDestinations.length === 0 ? (
                  <p className="text-sm text-slate-400 mb-2">Lịch trình chưa có địa điểm nào.</p>
                ) : (
                  <div className="mb-1">
                    {(showAllDests ? allDestinations : allDestinations.slice(0, 3)).map(d => (
                      <button
                        key={d.id}
                        onClick={() => { updateExpenseForm({ destinationId: d.id }); setExpenseDialog({ step: 'form' }); }}
                        className="w-full flex items-center gap-3 py-2 px-1 text-left rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <span className="h-9 w-9 shrink-0 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
                          <MapPin className="w-4 h-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-slate-800 font-medium">{d.placeName}</span>
                          <span className="block text-xs text-slate-400">Ngày {d.dayNumber}</span>
                        </span>
                        {expenseForm.destinationId === d.id && <span className="text-xs font-bold text-[#FF5645]">Đã chọn</span>}
                      </button>
                    ))}
                    {allDestinations.length > 3 && (
                      <button
                        onClick={() => setShowAllDests(v => !v)}
                        className="w-full flex items-center gap-3 py-2 px-1 text-left rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <span className="h-9 w-9 shrink-0 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
                          <MoreHorizontal className="w-4 h-4" />
                        </span>
                        <span className="text-slate-800 font-medium">{showAllDests ? 'Thu gọn' : 'Xem tất cả'}</span>
                      </button>
                    )}
                  </div>
                )}
                {expenseForm.destinationId && (
                  <button
                    onClick={() => updateExpenseForm({ destinationId: null })}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    Bỏ chọn địa điểm
                  </button>
                )}

                <hr className="my-5 border-slate-200" />

                <p className="font-bold text-slate-900 mb-3">Hoặc chọn theo danh mục</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {EXPENSE_CATEGORIES.map(({ key, label, Icon }) => (
                    <button
                      key={key}
                      onClick={() => { updateExpenseForm({ category: key }); setExpenseDialog({ step: 'form' }); }}
                      className={`flex flex-col items-center justify-center gap-2 rounded-xl py-4 text-xs font-semibold transition-colors ${
                        expenseForm.category === key
                          ? 'bg-red-50 text-[#FF5645] ring-1 ring-[#FF5645]'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ================= DIALOG SỬA NGÂN SÁCH ================= */}
      {budgetDialogOpen && (
        <div
          className="fixed inset-0 z-[3000] bg-black/50 flex items-center justify-center p-4"
          onClick={() => { if (!isSavingBudget) setBudgetDialogOpen(false); }}
        >
          <div
            className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setBudgetDialogOpen(false)}
              aria-label="Đóng"
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-xl font-extrabold text-slate-900 text-center mb-6 px-8">Ngân sách chuyến đi</h3>
            <label className="flex items-center gap-3 border border-slate-300 rounded-xl px-4 py-3 focus-within:border-slate-500 transition-colors">
              <span className="font-bold text-slate-700">₫</span>
              <input
                type="number"
                min="0"
                step="100000"
                autoFocus
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveBudget(); }}
                placeholder="VD: 10000000"
                className="w-full bg-transparent outline-none text-lg font-bold text-slate-800 placeholder:text-slate-300"
              />
            </label>
            <p className="text-sm text-slate-500 mt-2 h-5">{Number(budgetInput) > 0 ? `= ${formatVND(budgetInput)}` : ''}</p>
            <div className="flex justify-center mt-4">
              <button
                onClick={saveBudget}
                disabled={isSavingBudget}
                className="px-12 py-3 bg-[#FF5645] text-white font-bold rounded-full hover:bg-[#E04B3B] transition-colors disabled:opacity-50"
              >
                {isSavingBudget ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= DIALOG CÂN ĐỐI NHÓM ================= */}
      {balanceDialog && (
        <div
          className="fixed inset-0 z-[3000] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setBalanceDialog(null)}
        >
          <div
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setBalanceDialog(null)}
              aria-label="Đóng"
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-xl font-extrabold text-slate-900 text-center mb-6 px-8">Cân đối nhóm</h3>

            {balanceDialog.loading && <p className="text-center text-slate-500">Đang tính toán...</p>}
            {balanceDialog.error && <p className="text-center text-rose-600 font-medium">{balanceDialog.error}</p>}

            {balanceDialog.data && (
              <>
                <p className="font-bold text-slate-900 mb-3">Số dư của mỗi người</p>
                <div className="mb-6">
                  {balanceDialog.data.balances.map(b => {
                    const balance = Number(b.balance);
                    return (
                      <div key={b.userId} className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-100 last:border-0">
                        <span className="truncate text-slate-800 font-medium">
                          {b.userId === expenseData.currentUserId ? `Bạn (${b.fullName})` : b.fullName}
                        </span>
                        <span className={`shrink-0 text-sm font-bold ${balance > 0 ? 'text-emerald-600' : balance < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                          {balance > 0 ? `được nhận ${formatVND(balance)}` : balance < 0 ? `còn nợ ${formatVND(-balance)}` : 'đã cân bằng'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <p className="font-bold text-slate-900 mb-3">Cách thanh toán</p>
                {balanceDialog.data.transfers.length === 0 ? (
                  <p className="text-sm text-slate-500">Không ai nợ ai, mọi khoản tiền đã cân bằng.</p>
                ) : (
                  balanceDialog.data.transfers.map((t, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-100 last:border-0">
                      <span className="min-w-0 text-sm text-slate-700">
                        <span className="font-bold">{t.fromUserId === expenseData.currentUserId ? 'Bạn' : t.fromName}</span>
                        {' '}chuyển cho{' '}
                        <span className="font-bold">{t.toUserId === expenseData.currentUserId ? 'bạn' : t.toName}</span>
                      </span>
                      <span className="shrink-0 font-bold text-slate-900">{formatVND(t.amount)}</span>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ================= DIALOG PHÂN TÍCH CHI TIÊU ================= */}
      {breakdownOpen && (
        <div
          className="fixed inset-0 z-[3000] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setBreakdownOpen(false)}
        >
          <div
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setBreakdownOpen(false)}
              aria-label="Đóng"
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-xl font-extrabold text-slate-900 text-center mb-6 px-8">Phân tích chi tiêu</h3>

            {categoryTotals.length === 0 ? (
              <p className="text-center text-slate-500">Chưa có khoản chi nào để phân tích.</p>
            ) : (
              categoryTotals.map(({ key, label, Icon, amount, percent }) => (
                <div key={key} className="mb-4">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <Icon className="w-4 h-4 text-slate-500" /> {label}
                    </span>
                    <span className="text-sm font-bold text-slate-900">{formatVND(amount)} <span className="text-slate-400 font-medium">({percent}%)</span></span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ExpenseDialogs;
