import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AlertCircle, CheckCircle, Clock, TrendingDown, Users, Building } from 'lucide-react';

interface KpiFollowUp {
  id: string;
  code: string;
  indicator: { code: string; nameAr: string };
  department: { code: string; name: string };
  dataEntryUser: { name: string; email: string };
  performanceOwner: { name: string; email: string } | null;
  year: number;
  month: number;
  dueDate: string;
  daysLate: number | null;
  status: string;
  escalationLevel: number;
  qmNotes: string | null;
  createdAt: string;
}

interface Stats {
  period: { year: number; month: number };
  totalOverdue: number;
  byStatus: Array<{ status: string; _count: number }>;
  byEscalationLevel: Array<{ escalationLevel: number; _count: number }>;
  byDepartment: Array<{ departmentId: string; _count: number }>;
}

const KpiFollowUpDashboard: React.FC = () => {
  const [followUps, setFollowUps] = useState<KpiFollowUp[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    departmentId: '',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  });
  const [selectedFollowUp, setSelectedFollowUp] = useState<KpiFollowUp | null>(null);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [escalationNotes, setEscalationNotes] = useState('');

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');

        const [followUpRes, statsRes] = await Promise.all([
          axios.get('/api/kpi-followups', {
            params: filters,
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get('/api/kpi-followups/stats/summary', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        setFollowUps(followUpRes.data.data);
        setStats(statsRes.data);
        setError(null);
      } catch (err) {
        setError('فشل تحميل البيانات');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filters]);

  const handleEscalate = async () => {
    if (!selectedFollowUp) return;

    try {
      const token = localStorage.getItem('token');
      const newLevel = Math.min(selectedFollowUp.escalationLevel + 1, 2);

      await axios.post(
        `/api/kpi-followups/${selectedFollowUp.id}/escalate`,
        {
          escalationLevel: newLevel,
          notes: escalationNotes,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Refresh data
      setFilters({ ...filters });
      setShowEscalateModal(false);
      setEscalationNotes('');
      setSelectedFollowUp(null);
    } catch (err) {
      alert('فشل التصعيد');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-50 text-yellow-800 border-yellow-200';
      case 'FIRST_NOTICE':
        return 'bg-orange-50 text-orange-800 border-orange-200';
      case 'ESCALATED':
        return 'bg-red-50 text-red-800 border-red-200';
      case 'RESOLVED':
        return 'bg-green-50 text-green-800 border-green-200';
      default:
        return 'bg-gray-50 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDING: 'قيد الانتظار',
      FIRST_NOTICE: 'تنبيه أول',
      ESCALATED: 'مصعّدة',
      RESOLVED: 'مُحلّة',
      ABORTED: 'ملغاة',
    };
    return labels[status] || status;
  };

  const getEscalationLabel = (level: number) => {
    const labels = ['بدون تصعيد', 'مدير القسم', 'المدير التنفيذي'];
    return labels[level] || 'غير معروف';
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">جاري التحميل...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8" dir="rtl">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">سجل متابعة الإدخالات المتأخرة</h1>
          <p className="text-gray-600">إدارة المؤشرات المتأخرة والإجراءات التصحيحية</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-2">
            <AlertCircle className="text-red-600" size={20} />
            <span className="text-red-800">{error}</span>
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">إجمالي المتأخرات</p>
                  <p className="text-3xl font-bold text-red-600">{stats.totalOverdue}</p>
                </div>
                <AlertCircle className="text-red-600" size={32} />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">قيد الانتظار</p>
                  <p className="text-3xl font-bold text-yellow-600">
                    {stats.byStatus.find((s) => s.status === 'PENDING')?._count || 0}
                  </p>
                </div>
                <Clock className="text-yellow-600" size={32} />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">مصعّدة</p>
                  <p className="text-3xl font-bold text-orange-600">
                    {stats.byStatus.find((s) => s.status === 'ESCALATED')?._count || 0}
                  </p>
                </div>
                <TrendingDown className="text-orange-600" size={32} />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">مُحلّة</p>
                  <p className="text-3xl font-bold text-green-600">
                    {stats.byStatus.find((s) => s.status === 'RESOLVED')?._count || 0}
                  </p>
                </div>
                <CheckCircle className="text-green-600" size={32} />
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">الفلاتر</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="number"
              placeholder="السنة"
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: parseInt(e.target.value) })}
              className="border border-gray-300 rounded px-3 py-2"
            />
            <select
              value={filters.month}
              onChange={(e) => setFilters({ ...filters, month: parseInt(e.target.value) })}
              className="border border-gray-300 rounded px-3 py-2"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                <option key={m} value={m}>
                  شهر {m}
                </option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="border border-gray-300 rounded px-3 py-2"
            >
              <option value="">جميع الحالات</option>
              <option value="PENDING">قيد الانتظار</option>
              <option value="FIRST_NOTICE">تنبيه أول</option>
              <option value="ESCALATED">مصعّدة</option>
              <option value="RESOLVED">مُحلّة</option>
            </select>
            <button
              onClick={() => setFilters({ status: '', departmentId: '', year: new Date().getFullYear(), month: new Date().getMonth() + 1 })}
              className="bg-indigo-600 text-white rounded px-4 py-2 hover:bg-indigo-700"
            >
              إعادة تعيين
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-indigo-600 text-white">
              <tr>
                <th className="px-6 py-3 text-right">الرمز</th>
                <th className="px-6 py-3 text-right">المؤشر</th>
                <th className="px-6 py-3 text-right">الإدارة</th>
                <th className="px-6 py-3 text-right">مدخل البيانات</th>
                <th className="px-6 py-3 text-right">تاريخ الاستحقاق</th>
                <th className="px-6 py-3 text-right">أيام التأخير</th>
                <th className="px-6 py-3 text-right">الحالة</th>
                <th className="px-6 py-3 text-right">الإجراء</th>
              </tr>
            </thead>
            <tbody>
              {followUps.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    لا توجد سجلات متأخرة
                  </td>
                </tr>
              ) : (
                followUps.map((followUp) => (
                  <tr key={followUp.id} className="border-t hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono text-sm">{followUp.code}</td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold">{followUp.indicator.nameAr}</p>
                        <p className="text-sm text-gray-600">{followUp.indicator.code}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">{followUp.department.name}</td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold">{followUp.dataEntryUser.name}</p>
                        <p className="text-sm text-gray-600">{followUp.dataEntryUser.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {new Date(followUp.dueDate).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {followUp.daysLate ? (
                        <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-semibold">
                          {followUp.daysLate} يوم
                        </span>
                      ) : (
                        <span className="text-green-600">في الوقت</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(followUp.status)}`}>
                        {getStatusLabel(followUp.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {followUp.status !== 'RESOLVED' && (
                        <button
                          onClick={() => {
                            setSelectedFollowUp(followUp);
                            setShowEscalateModal(true);
                          }}
                          className="bg-orange-500 text-white px-3 py-1 rounded text-sm hover:bg-orange-600"
                        >
                          تصعيد
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Escalation Modal */}
      {showEscalateModal && selectedFollowUp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">تصعيد المتابعة</h3>
            <p className="text-gray-600 mb-4">{selectedFollowUp.indicator.nameAr}</p>
            <p className="text-sm text-gray-500 mb-4">
              المستوى الحالي: {getEscalationLabel(selectedFollowUp.escalationLevel)}
            </p>
            <textarea
              value={escalationNotes}
              onChange={(e) => setEscalationNotes(e.target.value)}
              placeholder="اكتب ملاحظات التصعيد..."
              className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
              rows={4}
            />
            <div className="flex gap-3">
              <button
                onClick={handleEscalate}
                className="flex-1 bg-orange-600 text-white rounded px-4 py-2 hover:bg-orange-700"
              >
                تصعيد
              </button>
              <button
                onClick={() => {
                  setShowEscalateModal(false);
                  setSelectedFollowUp(null);
                  setEscalationNotes('');
                }}
                className="flex-1 bg-gray-300 text-gray-800 rounded px-4 py-2 hover:bg-gray-400"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KpiFollowUpDashboard;
