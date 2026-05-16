import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { apiCallAuth } from '../utils/api';
import './Pages.css';

export default function Wallet() {
  const { token, user, updateUser } = useContext(AuthContext);
  const [wallet, setWallet] = useState(null);
  const [bankDetails, setBankDetails] = useState(null);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showBankForm, setShowBankForm] = useState(false);
  const [pendingWithdrawals, setPendingWithdrawals] = useState([]);
  const [bankFormData, setBankFormData] = useState({
    bankName: '',
    accountNumber: '',
    accountName: ''
  });

  const fetchWallet = useCallback(async () => {
    try {
      const [walletData, withdrawalData] = await Promise.all([
        apiCallAuth('/api/wallet', token),
        apiCallAuth('/api/wallet/withdrawals/pending', token)
      ]);
      
      if (walletData.success) {
        setWallet(walletData.wallet);
        setBankDetails(walletData.wallet.bankDetails);
      }
      
      if (withdrawalData.success) {
        setPendingWithdrawals(withdrawalData.withdrawals);
      }
    } catch (error) {
      setError('Failed to load wallet');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const handleBankDetailsChange = (e) => {
    const { name, value } = e.target;
    setBankFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveBankDetails = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!bankFormData.accountNumber || !bankFormData.bankName || !bankFormData.accountName) {
      setError('All bank details are required');
      return;
    }

    try {
      const data = await apiCallAuth(
        '/api/users/update-bank',
        token,
        {
          method: 'PUT',
          body: JSON.stringify({ bankDetails: bankFormData })
        }
      );

      if (data.success) {
        setSuccess('✓ Bank details saved successfully!');
        setBankDetails(data.user.bankDetails);
        
        // Update AuthContext with new user data including bank details
        if (updateUser && data.user) {
          updateUser({
            ...user,
            bankDetails: data.user.bankDetails
          });
        }
        
        setBankFormData({
          bankName: '',
          accountNumber: '',
          accountName: ''
        });
        setShowBankForm(false);
        
        setTimeout(() => {
          setSuccess('');
          fetchWallet();
        }, 1500);
      } else {
        setError(data.message || 'Failed to save bank details');
        console.log('Error response:', data);
      }
    } catch (error) {
      setError('Failed to save bank details. Check console for details.');
      console.error('Bank details error:', error);
    }
  };

  const handleWithdrawal = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!bankDetails) {
      setError('Please add bank details first');
      return;
    }

    const amount = parseFloat(withdrawalAmount);
    
    if (!withdrawalAmount || isNaN(amount) || amount <= 0) {
      setError('Please enter a valid withdrawal amount');
      return;
    }

    if (amount < 1000) {
      setError('Minimum withdrawal amount is ₦1,000');
      return;
    }

    if (amount > wallet?.balance) {
      setError(`Insufficient balance. Your balance is ₦${wallet?.balance || 0}`);
      return;
    }

    try {
      const data = await apiCallAuth(
        '/api/wallet/withdraw',
        token,
        {
          method: 'POST',
          body: JSON.stringify({ amount })
        }
      );

      if (data.success) {
        setSuccess('✓ Withdrawal request submitted successfully! Your request will be reviewed shortly.');
        setWithdrawalAmount('');
        
        // Immediately update wallet balance
        setWallet(prev => ({
          ...prev,
          balance: data.newBalance
        }));
        
        // Add to pending withdrawals
        setPendingWithdrawals(prev => [...prev, data.withdrawal]);
        
        setTimeout(() => {
          setSuccess('');
        }, 4000);
      } else {
        setError(data.message || 'Withdrawal request failed');
      }
    } catch (error) {
      setError('Withdrawal request failed. Please try again.');
      console.error('Withdrawal error:', error);
    }
  };

  if (loading) return <div className="loading">Loading wallet...</div>;

  const pendingTotal = pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0);

  return (
    <div className="wallet-container">
      <h1>💰 My Wallet</h1>

      <div className="wallet-balance">
        <div className="balance-item">
          <h3>Available Balance</h3>
          <h2>₦{(wallet?.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
        </div>
        {pendingTotal > 0 && (
          <div className="balance-item pending">
            <h3>⏳ Pending Withdrawals</h3>
            <h2>₦{pendingTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
          </div>
        )}
      </div>

      <div className="wallet-section">
        <h3>💳 Bank Details</h3>
        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        {bankDetails ? (
          <div>
            <div className="bank-details-display">
              <p><strong>Bank Name:</strong> {bankDetails.bankName}</p>
              <p><strong>Account Name:</strong> {bankDetails.accountName}</p>
              <p><strong>Account Number:</strong> {bankDetails.accountNumber}</p>
            </div>
            <button 
              onClick={() => {
                setBankFormData(bankDetails);
                setShowBankForm(true);
              }}
              className="btn-secondary"
            >
              Update Bank Details
            </button>
          </div>
        ) : null}

        {!bankDetails || showBankForm ? (
          <form onSubmit={handleSaveBankDetails} className="bank-details-form">
            <div className="form-group">
              <label>Bank Name *</label>
              <input
                type="text"
                name="bankName"
                placeholder="e.g., GTBank, Access Bank, First Bank"
                value={bankFormData.bankName}
                onChange={handleBankDetailsChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Account Name *</label>
              <input
                type="text"
                name="accountName"
                placeholder="Your full name as registered with bank"
                value={bankFormData.accountName}
                onChange={handleBankDetailsChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Account Number *</label>
              <input
                type="number"
                name="accountNumber"
                placeholder="Your 10-digit account number"
                value={bankFormData.accountNumber}
                onChange={handleBankDetailsChange}
                required
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary">
                {bankDetails ? 'Update Bank Details' : 'Save Bank Details'}
              </button>
              {bankDetails && (
                <button 
                  type="button" 
                  onClick={() => {
                    setShowBankForm(false);
                    setBankFormData({
                      bankName: '',
                      accountNumber: '',
                      accountName: ''
                    });
                  }}
                  className="btn-cancel"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        ) : null}
      </div>

      <div className="wallet-section">
        <h3>Request Withdrawal</h3>
        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        <div style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '12px', padding: '12px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '6px', fontSize: '14px', color: '#92400e' }}>
            <strong>ℹ️ A 7.5% withdrawal fee applies to all withdrawals.</strong>
          </div>
          <div style={{ padding: '12px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '6px', fontSize: '14px', color: '#92400e' }}>
            <strong>ℹ️ Minimum withdrawal amount is ₦1,000.</strong>
          </div>
        </div>

        {!bankDetails ? (
          <div className="no-bank-details">
            ⚠️ You must add bank details before requesting a withdrawal.
          </div>
        ) : (
          <form onSubmit={handleWithdrawal}>
            <div className="form-group">
              <label>Available Balance</label>
              <div style={{
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                border: '2px solid #667eea',
                borderRadius: '6px',
                padding: '12px',
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#667eea',
                marginBottom: '15px'
              }}>
                ₦{(wallet?.balance || 0).toLocaleString()}
              </div>
            </div>

            <div className="form-group">
              <label>Withdrawal Amount (NGN) *</label>
              <input
                type="number"
                placeholder="Enter amount (minimum ₦1,000)"
                value={withdrawalAmount}
                onChange={(e) => setWithdrawalAmount(e.target.value)}
                step="1000"
                min="1000"
                max={wallet?.balance || 0}
                required
              />
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '15px' }}>
              Request Withdrawal
            </button>
          </form>
        )}}
      </div>

      {pendingWithdrawals.length > 0 && (
        <div className="wallet-section">
          <h3>⏳ Pending Withdrawal Requests</h3>
          <div className="withdrawals-list">
            {pendingWithdrawals.map(withdrawal => (
              <div key={withdrawal.id} className="withdrawal-item">
                <div className="withdrawal-info">
                  <div className="withdrawal-amount">
                    ₦{withdrawal.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="withdrawal-details">
                    <p><strong>Status:</strong> <span className="status-badge pending">Pending</span></p>
                    <p><strong>Bank:</strong> {withdrawal.bankDetails?.accountName}</p>
                    <p><strong>Date:</strong> {new Date(withdrawal.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}