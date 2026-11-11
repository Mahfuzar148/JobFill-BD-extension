import React from 'react';
import { UserProfile, AddressInfo, AddressDetails } from '../../types/profile';

interface AddressPageProps {
  profile: UserProfile;
  onChange: (updated: Partial<AddressInfo>) => void;
}

export const AddressPage: React.FC<AddressPageProps> = ({ profile, onChange }) => {
  const addr = profile.address;

  const handlePresentChange = (field: keyof AddressDetails, value: string) => {
    const newPresent = { ...addr.present, [field]: value };
    if (addr.sameAsPresent) {
      onChange({
        present: newPresent,
        permanent: { ...newPresent },
      });
    } else {
      onChange({ present: newPresent });
    }
  };

  const handlePermanentChange = (field: keyof AddressDetails, value: string) => {
    onChange({
      permanent: { ...addr.permanent, [field]: value },
    });
  };

  const handleSameAsPresentToggle = (checked: boolean) => {
    if (checked) {
      onChange({
        sameAsPresent: true,
        permanent: { ...addr.present },
      });
    } else {
      onChange({ sameAsPresent: false });
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <span>🏠</span>
          <span>Address Information (বর্তমান ও স্থায়ী ঠিকানা)</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          পেট্রোবাংলা এবং সরকারি নিয়োগ ফরমের হুবহু দুটি কলাম অনুযায়ী বর্তমান ও স্থায়ী ঠিকানার তথ্য লিখুন।
        </p>
      </div>

      {/* Same as present address checkbox */}
      <div className="bg-petro-50 border border-petro-200 rounded-xl p-3.5 flex items-center gap-3">
        <input
          type="checkbox"
          id="chk_same_address"
          checked={addr.sameAsPresent}
          onChange={(e) => handleSameAsPresentToggle(e.target.checked)}
          className="w-4 h-4 text-petro-600 rounded focus:ring-petro-500 cursor-pointer accent-petro-600"
        />
        <label
          htmlFor="chk_same_address"
          className="text-xs font-bold text-petro-900 cursor-pointer select-none flex items-center gap-1.5"
        >
          <span>✅ Same as Present Address</span>
          <span className="font-normal text-slate-600">(স্থায়ী ঠিকানা বর্তমান ঠিকানার অনুরূপ)</span>
        </label>
      </div>

      {/* Side-by-Side Address Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Present Address Column */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-petro-100 pb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-petro-600"></span>
            <h3 className="text-sm font-bold text-petro-800">
              Present Address (বর্তমান ঠিকানা)
            </h3>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Care Of (অভিভাবকের নাম / প্রযত্নে)
            </label>
            <input
              type="text"
              value={addr.present.careOf}
              onChange={(e) => handlePresentChange('careOf', e.target.value)}
              placeholder="Father / Guardian Name"
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Village / Road / House / Flat <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={2}
              value={addr.present.village}
              onChange={(e) => handlePresentChange('village', e.target.value)}
              placeholder="House #12, Road #4, Block B, Mirpur"
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                District (জেলা) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={addr.present.district}
                onChange={(e) => handlePresentChange('district', e.target.value)}
                placeholder="Dhaka"
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Upazila / P.S. (উপজেলা/থানা) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={addr.present.upazila}
                onChange={(e) => handlePresentChange('upazila', e.target.value)}
                placeholder="Mirpur / Mohammadpur"
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Post Office (ডাকঘর)
              </label>
              <input
                type="text"
                value={addr.present.postOffice}
                onChange={(e) => handlePresentChange('postOffice', e.target.value)}
                placeholder="Mirpur-10"
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Post Code (পোস্ট কোড)
              </label>
              <input
                type="text"
                value={addr.present.postCode}
                onChange={(e) => handlePresentChange('postCode', e.target.value)}
                placeholder="1216"
                maxLength={6}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Division (বিভাগ)
            </label>
            <select
              value={addr.present.division}
              onChange={(e) => handlePresentChange('division', e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            >
              <option value="">Select Division</option>
              <option value="Dhaka">Dhaka (ঢাকা)</option>
              <option value="Chittagong">Chittagong (চট্টগ্রাম)</option>
              <option value="Rajshahi">Rajshahi (রাজশাহী)</option>
              <option value="Khulna">Khulna (খুলনা)</option>
              <option value="Barisal">Barisal (বরিশাল)</option>
              <option value="Sylhet">Sylhet (সিলেট)</option>
              <option value="Rangpur">Rangpur (রংপুর)</option>
              <option value="Mymensingh">Mymensingh (ময়মনসিংহ)</option>
            </select>
          </div>
        </div>

        {/* Permanent Address Column */}
        <div
          className={`bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 transition-opacity ${
            addr.sameAsPresent ? 'opacity-60 pointer-events-none' : ''
          }`}
        >
          <div className="flex items-center gap-2 border-b border-petro-100 pb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
            <h3 className="text-sm font-bold text-slate-800">
              Permanent Address (স্থায়ী ঠিকানা)
            </h3>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Care Of (অভিভাবকের নাম / প্রযত্নে)
            </label>
            <input
              type="text"
              disabled={addr.sameAsPresent}
              value={addr.permanent.careOf}
              onChange={(e) => handlePermanentChange('careOf', e.target.value)}
              placeholder="Father / Guardian Name"
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Village / Road / House / Flat <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={2}
              disabled={addr.sameAsPresent}
              value={addr.permanent.village}
              onChange={(e) => handlePermanentChange('village', e.target.value)}
              placeholder="Village / Road / Area Name"
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                District (জেলা) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                disabled={addr.sameAsPresent}
                value={addr.permanent.district}
                onChange={(e) => handlePermanentChange('district', e.target.value)}
                placeholder="District Name"
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Upazila / P.S. (উপজেলা/থানা) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                disabled={addr.sameAsPresent}
                value={addr.permanent.upazila}
                onChange={(e) => handlePermanentChange('upazila', e.target.value)}
                placeholder="Upazila Name"
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Post Office (ডাকঘর)
              </label>
              <input
                type="text"
                disabled={addr.sameAsPresent}
                value={addr.permanent.postOffice}
                onChange={(e) => handlePermanentChange('postOffice', e.target.value)}
                placeholder="Post Office"
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Post Code (পোস্ট কোড)
              </label>
              <input
                type="text"
                disabled={addr.sameAsPresent}
                value={addr.permanent.postCode}
                onChange={(e) => handlePermanentChange('postCode', e.target.value)}
                placeholder="Post Code"
                maxLength={6}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Division (বিভাগ)
            </label>
            <select
              disabled={addr.sameAsPresent}
              value={addr.permanent.division}
              onChange={(e) => handlePermanentChange('division', e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            >
              <option value="">Select Division</option>
              <option value="Dhaka">Dhaka (ঢাকা)</option>
              <option value="Chittagong">Chittagong (চট্টগ্রাম)</option>
              <option value="Rajshahi">Rajshahi (রাজশাহী)</option>
              <option value="Khulna">Khulna (খুলনা)</option>
              <option value="Barisal">Barisal (বরিশাল)</option>
              <option value="Sylhet">Sylhet (সিলেট)</option>
              <option value="Rangpur">Rangpur (রংপুর)</option>
              <option value="Mymensingh">Mymensingh (ময়মনসিংহ)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
