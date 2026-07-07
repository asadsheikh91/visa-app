import styles from './report.module.css'

export function Disclaimer() {
  return (
    <div className={styles.disclaimer}>
      <div className={styles.h}>Important Notice</div>
      ParchiVisa provides an educational, self-assessment readiness tool. This
      report is generated from information you supplied and from publicly available
      immigration guidance current at the date shown. It is <b>not legal advice</b>{' '}
      and does <b>not</b> constitute representation or advice from a licensed or
      registered immigration consultant (such as an RCIC/CICC member, a
      MARA-registered agent, or an OISC-regulated adviser). Immigration rules, fees,
      and thresholds change frequently and vary by individual circumstance. Always
      verify every requirement against official government sources before acting, and
      consult a licensed professional for advice on your specific case. ParchiVisa
      accepts no liability for decisions made on the basis of this report.
    </div>
  )
}
