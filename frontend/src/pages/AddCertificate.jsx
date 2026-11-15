import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/AddCertificate.css";
import { baladyData } from "../data/baladyData";
import { API_URL } from "../api";

const NATIONALITIES = [
  "مصر",
  "السعودية",
  "الهند",
  "بنجلاديش",
  "باكستان",
  "الفلبين",
  "اليمن"
];

const JOBS = [
  "عامل تحميل وتنزيل",
  "عامل",
  "عامل عادى",
  "سواق خاص",
  "حلاق",
  "عامل مطبخ"
];

const EDUCATIONAL_PROGRAMS = [
  "منشآت الغذاء",
  "صالونات حلاقة",
  "مغاسل ملابس"
];

function AddCertificate() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token") || (document.cookie.match(/(?:^|;\s*)token=([^;]+)/)?.[1]);

  // Helper to format Date to YYYY-MM-DD
  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  // Helper to get Hijri date string (YYYY-MM-DD)
  const getHijriDate = (date) => {
    const options = { year: 'numeric', month: '2-digit', day: '2-digit', calendar: 'islamic-umalqura' };
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', options).formatToParts(date);
    const y = parts.find(p => p.type === 'year').value;
    const m = parts.find(p => p.type === 'month').value;
    const d = parts.find(p => p.type === 'day').value;
    return `${y}-${m}-${d}`;
  };

  // Helper لتحويل الأرقام العربية (المشرقية والفارسية) إلى أرقام إنجليزية فورياً
  const convertArabicNumbersToEnglish = (str) => {
    if (!str) return str;
    const arabicToEnglishMap = {
      '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
      '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
      '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
      '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
    };
    return String(str).replace(/[٠-٩۰-۹]/g, (char) => arabicToEnglishMap[char] || char);
  };

  // Calculate Dates
  const today = new Date();

  // Gregorian +1 Year
  const nextYear = new Date();
  nextYear.setFullYear(today.getFullYear() + 1);

  // Hijri Calculations
  const todayHijriStr = getHijriDate(today); // e.g. 1447-08-05
  const [hYear, hMonth, hDay] = todayHijriStr.split('-');

  const expiryHijriStr = `${parseInt(hYear) + 1}-${hMonth}-${hDay}`; // 1448-08-05
  const eduHijriStr = `${parseInt(hYear) + 3}-${hMonth}-${hDay}`;    // 1450-08-05

  const [form, setForm] = useState({
    _id: "",
    customId: "",
    name: "",
    amana: "",
    baladiya: "",
    nationalId: "",
    healthCertificateNumber: "",
    gender: "",
    nationality: "",
    job: "",
    healthCertIssueDate: formatDate(today),
    healthCertExpiryDate: formatDate(nextYear),
    healthCertIssueDateHijri: todayHijriStr,
    healthCertExpiryDateHijri: expiryHijriStr,
    educationalProgram: "",
    educationalProgramEndDate: eduHijriStr,
    licenseNumber: "",
    establishmentName: "",
    establishmentNumber: "",
    selectedLogo: "logos/الرياض.png",
  });

  const [idStatus, setIdStatus] = useState({ checking: false, message: "", isError: false, isValidHex: false });
  const [photo, setPhoto] = useState(null);
  const [municipalities, setMunicipalities] = useState([]);
  const [isManualBaladiya, setIsManualBaladiya] = useState(false);
  const [manualBaladiya, setManualBaladiya] = useState("");

  // حالة اختيار المنشآت الأخيرة أو الإدخال اليدوي
  const [recentEstablishments, setRecentEstablishments] = useState([]);
  const [selectedEstOption, setSelectedEstOption] = useState("");
  const [isManualEst, setIsManualEst] = useState(false);
  const [loadingEsts, setLoadingEsts] = useState(true);

  // حالات الإدخال اليدوي للجنسية والمهنة والبرنامج التثقيفي
  const [isManualNationality, setIsManualNationality] = useState(false);
  const [isManualJob, setIsManualJob] = useState(false);
  const [isManualEducationalProgram, setIsManualEducationalProgram] = useState(false);

  // فحص صحة الآيدي وعدم تكراره في قاعدة البيانات
  const handleIdValidation = async (value) => {
    const trimmed = (value || "").trim();
    if (!trimmed) {
      setIdStatus({ checking: false, message: "", isError: false, isValidHex: false });
      return;
    }

    // 1. التحقق من الطول
    if (trimmed.length !== 24) {
      setIdStatus({
        checking: false,
        message: `طول الآيدي ${trimmed.length} من 24 خانة. (يجب أن يكون 24 خانة بالضبط)`,
        isError: true,
        isValidHex: false
      });
      return;
    }

    // 2. التحقق من أحرف الهيكسا
    if (!/^[0-9a-fA-F]{24}$/.test(trimmed)) {
      setIdStatus({
        checking: false,
        message: "الآيدي غير صالح: يجب أن يحتوي فقط على أرقام وحروف Hexadecimal (من 0-9 و a-f)",
        isError: true,
        isValidHex: false
      });
      return;
    }

    // 3. الصيغة هيكسا صحيحة 100% -> فحص عدم التكرار مع السيرفر
    setIdStatus({ checking: true, message: "جاري التحقق من عدم التكرار في قاعدة البيانات...", isError: false, isValidHex: true });
    try {
      const res = await axios.get(`${API_URL}/api/certificates/check-id/${trimmed}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.available) {
        setIdStatus({ checking: false, message: "✅ الآيدي هيكسا صالح ومتاح للاستخدام (غير مكرر)", isError: false, isValidHex: true });
      } else {
        setIdStatus({ checking: false, message: `❌ ${res.data.message}`, isError: true, isValidHex: true });
      }
    } catch (err) {
      setIdStatus({ checking: false, message: "✅ صيغة الآيدي صحيحة (24 خانة Hexadecimal)", isError: false, isValidHex: true });
    }
  };

  // Auto-fill next sequential health certificate number
  useEffect(() => {
    const fetchNextNumber = async () => {
      try {
        const authToken = localStorage.getItem('token') || (document.cookie.match(/(?:^|;\s*)token=([^;]+)/)?.[1]);
        const res = await axios.get(`${API_URL}/api/certificates-next-number`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        setForm(prev => ({ ...prev, healthCertificateNumber: res.data.nextNumber }));
      } catch (err) {
        console.log('Could not fetch next certificate number', err);
      }
    };
    fetchNextNumber();
  }, []);

  // جلب آخر خمس منشآت فريدة (غير مكررة) من النظام
  useEffect(() => {
    const fetchRecentEstablishments = async () => {
      try {
        const authToken = localStorage.getItem('token') || (document.cookie.match(/(?:^|;\s*)token=([^;]+)/)?.[1]);
        let data = [];

        // 1. محاولة الجلب من Endpoint مخصص
        try {
          const res = await axios.get(`${API_URL}/api/certificates/recent-establishments`, {
            headers: { Authorization: `Bearer ${authToken}` }
          });
          if (Array.isArray(res.data) && res.data.length > 0) {
            data = res.data;
          }
        } catch (e) {
          // في حال عدم توفر الـ Endpoint على الخادم المباشر، يتم الاعتماد على الـ Fallback
        }

        // 2. Fallback: استخراج آخر 5 منشآت غير مكررة من قائمة الشهادات
        if (data.length === 0) {
          try {
            const resAll = await axios.get(`${API_URL}/api/certificates`, {
              headers: { Authorization: `Bearer ${authToken}` }
            });
            const certs = resAll.data || [];
            const seen = new Set();
            const list = [];
            for (const cert of certs) {
              const name = (cert.establishmentName || '').trim();
              if (!name) continue;
              const key = name.toLowerCase();
              if (!seen.has(key)) {
                seen.add(key);
                list.push({
                  establishmentName: name,
                  licenseNumber: cert.licenseNumber || '',
                  establishmentNumber: cert.establishmentNumber || '',
                  amana: cert.amana || '',
                  baladiya: cert.baladiya || '',
                  selectedLogo: cert.selectedLogo || ''
                });
                if (list.length === 5) break;
              }
            }
            data = list;
          } catch (e2) {
            console.error("Could not fetch certificates for fallback", e2);
          }
        }

        setRecentEstablishments(data);
        if (data.length === 0) {
          // إذا لم تكن هناك أي منشآت مسجلة في النظام مسبقاً، تفعيل الإدخال اليدوي افتراضياً
          setSelectedEstOption("OTHER");
          setIsManualEst(true);
        }
      } catch (err) {
        console.error("Error in fetchRecentEstablishments:", err);
      } finally {
        setLoadingEsts(false);
      }
    };

    fetchRecentEstablishments();
  }, [token]);

  // التعامل مع اختيار منشأة من القائمة أو اختيار "أخرى"
  const handleEstablishmentSelectChange = (e) => {
    const value = e.target.value;
    setSelectedEstOption(value);

    if (value === "OTHER") {
      setIsManualEst(true);
      setForm(prev => ({
        ...prev,
        establishmentName: "",
        licenseNumber: "",
        establishmentNumber: ""
      }));
    } else if (value === "") {
      setIsManualEst(false);
      setForm(prev => ({
        ...prev,
        establishmentName: "",
        licenseNumber: "",
        establishmentNumber: ""
      }));
    } else {
      setIsManualEst(false);
      const estIndex = parseInt(value, 10);
      const selected = recentEstablishments[estIndex];
      if (selected) {
        let nextAmana = selected.amana || form.amana;
        let nextLogo = form.selectedLogo;
        let nextBaladiya = selected.baladiya || form.baladiya;

        if (selected.amana && baladyData[selected.amana]) {
          const selectedData = baladyData[selected.amana];
          nextLogo = selected.selectedLogo || selectedData.logo || "logos/الرياض.png";
          setMunicipalities(selectedData.municipalities || []);
          setIsManualBaladiya(false);
          setManualBaladiya("");
        }

        setForm(prev => ({
          ...prev,
          establishmentName: selected.establishmentName || "",
          licenseNumber: selected.licenseNumber || "",
          establishmentNumber: selected.establishmentNumber || "",
          amana: nextAmana,
          baladiya: nextBaladiya,
          selectedLogo: nextLogo
        }));
      }
    }
  };

  const handleLockedFieldClick = () => {
    if (!isManualEst && selectedEstOption === "") {
      setSelectedEstOption("OTHER");
      setIsManualEst(true);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "_id" || name === "customId") {
      setForm({ ...form, _id: value, customId: value });
      handleIdValidation(value);
      return;
    }
    if (name === "baladiya") {
      if (value === "OTHER") {
        setIsManualBaladiya(true);
        setForm({ ...form, baladiya: "OTHER" });
      } else {
        setIsManualBaladiya(false);
        setForm({ ...form, baladiya: value });
      }
      return;
    }

    // تحويل تلقائي فوري لأي أرقام عربية مكتوبة أو ملصقة في رقم الإقامة / الهوية (وكذلك باقي أرقام الرخص والشهادات)
    const convertedValue = (name === "nationalId" || name === "licenseNumber" || name === "establishmentNumber" || name === "healthCertificateNumber")
      ? convertArabicNumbersToEnglish(value)
      : value;

    setForm({ ...form, [name]: convertedValue });
  };

  // معالجة اللصق (Paste) الفوري لأرقام الإقامة لتحويل أي أرقام عربية إلى إنجليزية مباشرة
  const handleNationalIdPaste = (e) => {
    const pasteData = e.clipboardData.getData('text');
    if (/[٠-٩۰-۹]/.test(pasteData)) {
      e.preventDefault();
      const converted = convertArabicNumbersToEnglish(pasteData);
      const input = e.target;
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;
      const current = form.nationalId || "";
      const updated = current.slice(0, start) + converted + current.slice(end);
      setForm(prev => ({ ...prev, nationalId: convertArabicNumbersToEnglish(updated) }));
    }
  };

  const handleNationalitySelectChange = (e) => {
    const value = e.target.value;
    if (value === "OTHER") {
      setIsManualNationality(true);
      setForm(prev => ({ ...prev, nationality: "" }));
    } else {
      setIsManualNationality(false);
      setForm(prev => ({ ...prev, nationality: value }));
    }
  };

  const handleJobSelectChange = (e) => {
    const value = e.target.value;
    if (value === "OTHER") {
      setIsManualJob(true);
      setForm(prev => ({ ...prev, job: "" }));
    } else {
      setIsManualJob(false);
      setForm(prev => ({ ...prev, job: value }));
    }
  };

  const handleEducationalProgramSelectChange = (e) => {
    const value = e.target.value;
    if (value === "OTHER") {
      setIsManualEducationalProgram(true);
      setForm(prev => ({ ...prev, educationalProgram: "" }));
    } else {
      setIsManualEducationalProgram(false);
      setForm(prev => ({ ...prev, educationalProgram: value }));
    }
  };

  const handleManualBaladiyaChange = (e) => {
    setManualBaladiya(e.target.value);
  };

  const handleAmanaChange = (e) => {
    const selectedAmana = e.target.value;
    const selectedData = baladyData[selectedAmana];
    const correspondingLogo = selectedData?.logo || "logos/الرياض.png";
    const availableMunicipalities = selectedData?.municipalities || [];

    setForm({
      ...form,
      amana: selectedAmana,
      baladiya: "", // Reset municipality when Amana changes
      selectedLogo: correspondingLogo
    });
    setMunicipalities(availableMunicipalities);
    setIsManualBaladiya(false);
    setManualBaladiya("");
  };

  const handleLicenseBlur = async () => {
    if (!form.licenseNumber) return;

    try {
      const res = await axios.get(`${API_URL}/api/certificates/license/${form.licenseNumber}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data) {
        const data = res.data;

        // Update municipalities based on the fetched amana
        const selectedData = baladyData[data.amana];
        const availableMunicipalities = selectedData?.municipalities || [];

        setMunicipalities(availableMunicipalities);

        setForm(prev => ({
          ...prev,
          establishmentName: data.establishmentName || prev.establishmentName,
          establishmentNumber: data.establishmentNumber || prev.establishmentNumber,
          amana: data.amana || prev.amana,
          baladiya: data.baladiya || prev.baladiya,
          selectedLogo: data.selectedLogo || prev.selectedLogo
        }));

        alert("تم العثور على بيانات لهذه الرخصة وتم تعبئتها تلقائياً");
      }
    } catch (err) {
      // Quietly fail if not found, or maybe just log
      console.log("No existing data for this license");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const formData = new FormData();
      formData.append("name", form.name);
      formData.append("amana", form.amana);
      formData.append("baladiya", isManualBaladiya ? manualBaladiya : form.baladiya);
      formData.append("nationalId", form.nationalId);
      formData.append("healthCertificateNumber", form.healthCertificateNumber);
      formData.append("gender", form.gender);
      formData.append("nationality", form.nationality);
      formData.append("job", form.job);
      formData.append("healthCertIssueDate", form.healthCertIssueDate);
      formData.append("healthCertExpiryDate", form.healthCertExpiryDate);
      formData.append("healthCertIssueDateHijri", form.healthCertIssueDateHijri);
      formData.append("healthCertExpiryDateHijri", form.healthCertExpiryDateHijri);
      formData.append("educationalProgram", form.educationalProgram);
      formData.append("educationalProgramEndDate", form.educationalProgramEndDate);
      formData.append("licenseNumber", form.licenseNumber);
      formData.append("establishmentName", form.establishmentName);
      formData.append("establishmentNumber", form.establishmentNumber);
      formData.append("selectedLogo", form.selectedLogo);

      if (photo) {
        formData.append("photo", photo);
      }

      if (!isManualEst && selectedEstOption === "" && !form.establishmentName) {
        alert("يرجى اختيار اسم المنشأة من القائمة أو اختيار 'أخرى' للإدخال اليدوي.");
        return;
      }
      if (isManualEst && !form.establishmentName.trim()) {
        alert("يرجى إدخال اسم المنشأة.");
        return;
      }

      const rawId = (form._id || form.customId || "").trim();
      if (rawId) {
        if (rawId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(rawId)) {
          alert("الآيدي غير صالح: يجب أن يكون مكوناً من 24 خانة بنظام Hexadecimal (أرقام 0-9 وحروف a-f).");
          return;
        }
        if (idStatus.isError && idStatus.message.includes("مستخدم بالفعل")) {
          alert("الآيدي مكرر بالفعل ومسجل لشهادة أخرى في قاعدة البيانات. يرجى اختيار آيدي مختلف.");
          return;
        }
        formData.append("_id", rawId);
        formData.append("customId", rawId);
      }

      const res = await axios.post(
        `${API_URL}/api/certificates`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      alert("تم إضافة الشهادة بنجاح");
      navigate("/dashboard");

    } catch (err) {
      console.log(err);
      const msg = err.response?.data?.message || err.response?.data?.detail || "فيه خطأ أثناء حفظ الشهادة";
      alert(msg);
    }
  };

  return (
    <div className="add-certificate-container">
      <div className="add-certificate-header">
        <h2>إضافة شهادة صحية جديدة</h2>
      </div>

      <form className="add-certificate-form" onSubmit={handleSubmit}>

        <div style={{
          gridColumn: '1 / -1',
          background: idStatus.isError ? '#fef2f2' : (idStatus.isValidHex && !idStatus.isError ? '#f0fdf4' : '#f8fafc'),
          padding: '16px 20px',
          borderRadius: '10px',
          border: `1.5px solid ${idStatus.isError ? '#f87171' : (idStatus.isValidHex && !idStatus.isError ? '#4ade80' : '#e2e8f0')}`,
          transition: 'all 0.3s ease',
          marginBottom: '5px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ margin: 0, fontWeight: '700', color: '#1e293b', fontSize: '14px' }}>
              معرف الشهادة في قاعدة البيانات (_id) - اختياري
            </label>
            <span style={{
              fontSize: '12px',
              color: (form._id || form.customId || '').trim().length === 24 ? '#16a34a' : '#64748b',
              fontWeight: '700',
              direction: 'ltr'
            }}>
              {((form._id || form.customId || '').trim().length)} / 24 hex
            </span>
          </div>
          <input
            type="text"
            name="_id"
            value={form._id || form.customId || ""}
            onChange={handleChange}
            placeholder="مثال: 6512bd349f82d10a23b49102 (24 خانة Hexadecimal - اتركه فارغاً لإنشاء آيدي تلقائي)"
            maxLength={24}
            style={{
              direction: 'ltr',
              textAlign: 'left',
              fontFamily: 'monospace',
              letterSpacing: '1px',
              fontSize: '14px',
              border: `1.5px solid ${idStatus.isError ? '#ef4444' : (idStatus.isValidHex && !idStatus.isError ? '#22c55e' : '#cbd5e1')}`,
              backgroundColor: '#ffffff'
            }}
          />
          {idStatus.message && (
            <div style={{
              marginTop: '6px',
              fontSize: '13px',
              fontWeight: '600',
              color: idStatus.isError ? '#dc2626' : '#16a34a'
            }}>
              {idStatus.checking ? '⏳ ' : ''}{idStatus.message}
            </div>
          )}
          {!idStatus.message && (
            <span style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              💡 خانة اختيارية: إذا تُركت فارغة، سيقوم MongoDB بإنشاء _id عشوائي فريد تلقائياً.
            </span>
          )}
        </div>

        <div>
          <label>اسم الشخص *</label>
          <input type="text" name="name" value={form.name} onChange={handleChange} placeholder="أدخل الاسم الكامل" required />
        </div>

        <div style={{
          gridColumn: '1 / -1',
          background: '#f0f9ff',
          padding: '18px 20px',
          borderRadius: '10px',
          border: '1.5px solid #bae6fd',
          marginBottom: '10px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🏢</span> بيانات الرخصة والمنشأة
            </h3>
            {isManualEst ? (
              <span style={{ fontSize: '12px', background: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: '20px', fontWeight: 'bold' }}>
                ✏️ إدخال يدوي مفعّل للثلاث خانات
              </span>
            ) : selectedEstOption !== "" ? (
              <span style={{ fontSize: '12px', background: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '20px', fontWeight: 'bold' }}>
                ⚡ تم تعبئة البيانات تلقائياً
              </span>
            ) : null}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
            {/* 1. اسم المنشأة */}
            <div>
              <label style={{ fontWeight: '700', color: '#1e293b' }}>
                اسم المنشأة *
              </label>
              <select
                name="establishmentSelect"
                value={selectedEstOption}
                onChange={handleEstablishmentSelectChange}
                style={{
                  border: isManualEst ? '2px solid #22c55e' : '2px solid #0284c7',
                  backgroundColor: '#ffffff',
                  fontWeight: '600'
                }}
              >
                <option value="">
                  {loadingEsts ? "⏳ جاري تحميل آخر المنشآت..." : "-- اختر المنشأة (آخر 5 منشآت) --"}
                </option>
                {recentEstablishments.map((est, idx) => (
                  <option key={idx} value={String(idx)}>
                    {est.establishmentName}
                  </option>
                ))}
                <option value="OTHER" style={{ fontWeight: 'bold', color: '#16a34a' }}>
                  ➕ أخرى (إدخال يدوي)
                </option>
              </select>

              {isManualEst && (
                <input
                  type="text"
                  name="establishmentName"
                  value={form.establishmentName}
                  onChange={handleChange}
                  placeholder="اكتب اسم المنشأة يدوياً هنا"
                  required={isManualEst}
                  style={{
                    marginTop: '8px',
                    border: '2px solid #22c55e',
                    backgroundColor: '#f0fdf4'
                  }}
                />
              )}
            </div>

            {/* 2. رقم الرخصة */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontWeight: '700', color: '#1e293b' }}>رقم الرخصة</label>
                {!isManualEst && selectedEstOption !== "" && (
                  <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 'bold' }}>🔒 تلقائي</span>
                )}
              </div>
              <input
                type="text"
                name="licenseNumber"
                value={form.licenseNumber}
                onChange={handleChange}
                onClick={handleLockedFieldClick}
                onBlur={isManualEst ? handleLicenseBlur : undefined}
                placeholder={isManualEst ? "أدخل رقم الرخصة يدوياً" : (selectedEstOption !== "" ? "تم الجلب تلقائياً" : "اختر المنشأة أولاً أو اختر أخرى")}
                readOnly={!isManualEst}
                style={{
                  backgroundColor: !isManualEst ? '#f8fafc' : '#ffffff',
                  border: isManualEst ? '2px solid #22c55e' : (!isManualEst && selectedEstOption !== "" ? '1.5px solid #94a3b8' : '1.5px solid #cbd5e1'),
                  cursor: !isManualEst ? (selectedEstOption === "" ? 'pointer' : 'default') : 'text',
                  color: !isManualEst ? '#334155' : '#000000',
                  fontWeight: !isManualEst && selectedEstOption !== "" ? '600' : 'normal'
                }}
              />
              {!isManualEst && selectedEstOption !== "" && (
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', display: 'block' }}>
                  يتم جلبه تلقائياً بناءً على المنشأة المختارة
                </span>
              )}
            </div>

            {/* 3. رقم المنشأة */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontWeight: '700', color: '#1e293b' }}>رقم المنشأة</label>
                {!isManualEst && selectedEstOption !== "" && (
                  <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 'bold' }}>🔒 تلقائي</span>
                )}
              </div>
              <input
                type="text"
                name="establishmentNumber"
                value={form.establishmentNumber}
                onChange={handleChange}
                onClick={handleLockedFieldClick}
                placeholder={isManualEst ? "أدخل رقم المنشأة يدوياً" : (selectedEstOption !== "" ? "تم الجلب تلقائياً" : "اختر المنشأة أولاً أو اختر أخرى")}
                readOnly={!isManualEst}
                style={{
                  backgroundColor: !isManualEst ? '#f8fafc' : '#ffffff',
                  border: isManualEst ? '2px solid #22c55e' : (!isManualEst && selectedEstOption !== "" ? '1.5px solid #94a3b8' : '1.5px solid #cbd5e1'),
                  cursor: !isManualEst ? (selectedEstOption === "" ? 'pointer' : 'default') : 'text',
                  color: !isManualEst ? '#334155' : '#000000',
                  fontWeight: !isManualEst && selectedEstOption !== "" ? '600' : 'normal'
                }}
              />
              {!isManualEst && selectedEstOption !== "" && (
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', display: 'block' }}>
                  يتم جلبه تلقائياً بناءً على المنشأة المختارة
                </span>
              )}
            </div>
          </div>
        </div>

        <div>
          <label>الأمانة / المنطقة *</label>
          <select name="amana" value={form.amana} onChange={handleAmanaChange} required>
            <option value="">اختر الأمانة أو المنطقة</option>
            {Object.keys(baladyData).map((amanaName) => (
              <option key={amanaName} value={amanaName}>
                {amanaName}
              </option>
            ))}
          </select>
          {form.amana && form.selectedLogo && (
            <img
              src={`/${form.selectedLogo}`}
              alt="لوجو الأمانة"
              style={{ width: '100px', height: '100px', objectFit: 'contain', marginTop: '10px', border: '1px solid #ddd', padding: '5px', borderRadius: '4px', backgroundColor: 'white' }}
            />
          )}
        </div>

        <div>
          <label>البلدية</label>
          <select name="baladiya" value={form.baladiya} onChange={handleChange} required>
            <option value="">اختر البلدية</option>
            <option value="OTHER">أخرى (إدخال يدوي)</option>
            {municipalities.map((municipality, index) => (
              <option key={index} value={municipality}>
                {municipality}
              </option>
            ))}
          </select>
          {isManualBaladiya && (
            <input
              type="text"
              value={manualBaladiya}
              onChange={handleManualBaladiyaChange}
              placeholder="اكتب اسم البلدية هنا"
              required
              style={{ marginTop: '10px', border: '2px solid #4caf50' }}
            />
          )}
        </div>

        <div>
          <label>رقم الهوية / الإقامة *</label>
          <input
            type="text"
            name="nationalId"
            value={form.nationalId}
            onChange={handleChange}
            onPaste={handleNationalIdPaste}
            placeholder="أدخل رقم الهوية أو الإقامة"
            required
          />
        </div>
        <div>
          <label>الجنس</label>
          <input type="text" name="gender" value={form.gender} onChange={handleChange} placeholder="ذكر / أنثى" />
        </div>

        <div>
          <label>رقم الشهادة الصحية</label>
          <input type="text" name="healthCertificateNumber" value={form.healthCertificateNumber} onChange={handleChange} placeholder="أدخل رقم الشهادة الصحية" />
        </div>

        <div>
          <label>الجنسية</label>
          <select
            value={isManualNationality ? "OTHER" : (NATIONALITIES.includes(form.nationality) ? form.nationality : (form.nationality ? "OTHER" : ""))}
            onChange={handleNationalitySelectChange}
          >
            <option value="">اختر الجنسية</option>
            {NATIONALITIES.map((nat) => (
              <option key={nat} value={nat}>
                {nat}
              </option>
            ))}
            <option value="OTHER">أخرى (إدخال يدوي)</option>
          </select>
          {(isManualNationality || (form.nationality && !NATIONALITIES.includes(form.nationality))) && (
            <input
              type="text"
              name="nationality"
              value={form.nationality}
              onChange={handleChange}
              placeholder="اكتب الجنسية هنا"
              style={{ marginTop: '10px', border: '2px solid #4caf50' }}
            />
          )}
        </div>

        <div>
          <label>المهنة</label>
          <select
            value={isManualJob ? "OTHER" : (JOBS.includes(form.job) ? form.job : (form.job ? "OTHER" : ""))}
            onChange={handleJobSelectChange}
          >
            <option value="">اختر المهنة</option>
            {JOBS.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
            <option value="OTHER">أخرى (إدخال يدوي)</option>
          </select>
          {(isManualJob || (form.job && !JOBS.includes(form.job))) && (
            <input
              type="text"
              name="job"
              value={form.job}
              onChange={handleChange}
              placeholder="اكتب المهنة هنا"
              style={{ marginTop: '10px', border: '2px solid #4caf50' }}
            />
          )}
        </div>

        <div>
          <label>تاريخ إصدار الشهادة الصحية</label>
          <input type="text" name="healthCertIssueDate" value={form.healthCertIssueDate} onChange={handleChange} placeholder="YYYY-MM-DD" />
        </div>

        <div>
          <label>تاريخ إصدار الشهادة الصحية (هجري)</label>
          <input type="text" name="healthCertIssueDateHijri" value={form.healthCertIssueDateHijri} onChange={handleChange} placeholder="مثال: 1447-05-01" />
        </div>

        <div>
          <label>تاريخ انتهاء الشهادة الصحية</label>
          <input type="text" name="healthCertExpiryDate" value={form.healthCertExpiryDate} onChange={handleChange} placeholder="YYYY-MM-DD" />
        </div>

        <div>
          <label>تاريخ انتهاء الشهادة الصحية (هجري)</label>
          <input type="text" name="healthCertExpiryDateHijri" value={form.healthCertExpiryDateHijri} onChange={handleChange} placeholder="مثال: 1448-05-01" />
        </div>

        <div>
          <label>نوع البرنامج التثقيفي</label>
          <select
            value={isManualEducationalProgram ? "OTHER" : (EDUCATIONAL_PROGRAMS.includes(form.educationalProgram) ? form.educationalProgram : (form.educationalProgram ? "OTHER" : ""))}
            onChange={handleEducationalProgramSelectChange}
          >
            <option value="">اختر نوع البرنامج التثقيفي</option>
            {EDUCATIONAL_PROGRAMS.map((prog) => (
              <option key={prog} value={prog}>
                {prog}
              </option>
            ))}
            <option value="OTHER">أخرى (إدخال يدوي)</option>
          </select>
          {(isManualEducationalProgram || (form.educationalProgram && !EDUCATIONAL_PROGRAMS.includes(form.educationalProgram))) && (
            <input
              type="text"
              name="educationalProgram"
              value={form.educationalProgram}
              onChange={handleChange}
              placeholder="اكتب نوع البرنامج التثقيفي هنا"
              style={{ marginTop: '10px', border: '2px solid #4caf50' }}
            />
          )}
        </div>

        <div>
          <label>تاريخ انتهاء البرنامج التثقيفي (هجري) *</label>
          <input type="text" name="educationalProgramEndDate" value={form.educationalProgramEndDate} onChange={handleChange} placeholder="تاريخ هجري مثال: 1450-08-05" />
        </div>



        <div>
          <label>صورة الشخص</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPhoto(e.target.files[0])}
          />
        </div>

        <button type="submit" className="add-certificate-btn">✓ حفظ الشهادة</button>
      </form>
    </div>
  );
}

export default AddCertificate;
