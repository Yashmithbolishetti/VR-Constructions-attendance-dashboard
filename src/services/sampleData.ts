/**
 * VR CONSTRUCTIONS — PRODUCTION SAMPLE BIOMETRIC EXPORT DATA
 *
 * Modeled verbatim after standard enterprise biometric logs:
 * No   Mchn  EnNo  Name              Mode  IOMd  DateTime
 *
 * Covers:
 * - 9 Construction & Engineering employees
 * - Month transition: August 28, 2026 to September 02, 2026
 * - Standard shifts (09:55 - 18:05)
 * - Late arrivals (> 10:15 AM)
 * - Early departures (< 06:00 PM)
 * - Multi-punch mid-day records (lunch break ins/outs)
 * - Rapid bounce punches (< 60s)
 * - Duplicate machine entries
 * - Single punch historical (Aug 31)
 * - Single punch current date / report date (Sep 02 -> OUT_PENDING)
 * - Sunday weekend logs
 */

export const SAMPLE_BIOMETRIC_FILE_NAME = 'VR_Biometric_Attendance_Export_Aug_Sep_2026.txt';

export const SAMPLE_BIOMETRIC_RAW_TEXT = `No\tMchn\tEnNo\tName\tMode\tIOMd\tDateTime
000050\t1\t000000008\tmanisha\t1\t0\t2026/08/25 09:36:56
000051\t1\t000000008\tmanisha\t1\t0\t2026/08/25 17:44:35
000052\t1\t000000008\tmanisha\t1\t0\t2026/08/26 09:50:12
000053\t1\t000000008\tmanisha\t1\t0\t2026/08/26 18:05:20
000054\t1\t000000008\tmanisha\t1\t0\t2026/08/27 09:42:15
000055\t1\t000000008\tmanisha\t1\t0\t2026/08/27 18:10:00
000056\t1\t000000008\tmanisha\t1\t0\t2026/08/28 09:55:00
000057\t1\t000000008\tmanisha\t1\t0\t2026/08/28 17:52:10
000058\t1\t000000008\tmanisha\t1\t0\t2026/08/29 10:20:00
000059\t1\t000000008\tmanisha\t1\t0\t2026/08/29 18:02:40
1\t1\t101\tRajesh Kumar\t1\t0\t2026/08/31 09:52:14
2\t1\t101\tRajesh Kumar\t1\t0\t2026/08/31 18:08:22
3\t1\t102\tPriya Sharma\t1\t0\t2026/08/31 09:48:05
4\t1\t102\tPriya Sharma\t1\t0\t2026/08/31 13:25:10
5\t1\t102\tPriya Sharma\t1\t0\t2026/08/31 14:31:40
6\t1\t102\tPriya Sharma\t1\t0\t2026/08/31 18:15:33
7\t1\t103\tAmit Patel\t1\t0\t2026/08/31 10:28:44
8\t1\t103\tAmit Patel\t1\t0\t2026/08/31 18:32:10
9\t1\t104\tSunita Verma\t1\t0\t2026/08/31 09:55:00
10\t1\t104\tSunita Verma\t1\t0\t2026/08/31 17:15:20
11\t1\t105\tVikram Singh\t1\t0\t2026/08/31 09:58:30
12\t1\t106\tAnanya Reddy\t1\t0\t2026/08/31 09:40:12
13\t1\t106\tAnanya Reddy\t1\t0\t2026/08/31 09:40:35
14\t1\t106\tAnanya Reddy\t1\t0\t2026/08/31 18:02:11
15\t1\t107\tMohammed Farooq\t1\t0\t2026/08/31 09:51:00
16\t1\t107\tMohammed Farooq\t1\t0\t2026/08/31 18:05:40
17\t1\t108\tKavita Nair\t1\t0\t2026/08/31 09:54:19
18\t1\t108\tKavita Nair\t1\t0\t2026/08/31 18:10:05
19\t1\t109\tSuresh Babu\t1\t0\t2026/08/31 10:02:40
20\t1\t109\tSuresh Babu\t1\t0\t2026/08/31 18:04:12
21\t1\t101\tRajesh Kumar\t1\t0\t2026/09/01 09:50:11
22\t1\t101\tRajesh Kumar\t1\t0\t2026/09/01 18:12:45
23\t1\t102\tPriya Sharma\t1\t0\t2026/09/01 09:45:30
24\t1\t102\tPriya Sharma\t1\t0\t2026/09/01 18:20:10
25\t1\t103\tAmit Patel\t1\t0\t2026/09/01 10:35:12
26\t1\t103\tAmit Patel\t1\t0\t2026/09/01 18:40:00
27\t1\t104\tSunita Verma\t1\t0\t2026/09/01 09:58:02
28\t1\t104\tSunita Verma\t1\t0\t2026/09/01 18:05:15
29\t1\t105\tVikram Singh\t1\t0\t2026/09/01 09:52:19
30\t1\t105\tVikram Singh\t1\t0\t2026/09/01 18:11:04
31\t1\t106\tAnanya Reddy\t1\t0\t2026/09/01 09:44:50
32\t1\t106\tAnanya Reddy\t1\t0\t2026/09/01 18:06:22
33\t1\t107\tMohammed Farooq\t1\t0\t2026/09/01 09:50:40
34\t1\t107\tMohammed Farooq\t1\t0\t2026/09/01 18:08:15
35\t1\t108\tKavita Nair\t1\t0\t2026/09/01 09:55:12
36\t1\t108\tKavita Nair\t1\t0\t2026/09/01 18:02:50
37\t1\t109\tSuresh Babu\t1\t0\t2026/09/01 09:57:33
38\t1\t109\tSuresh Babu\t1\t0\t2026/09/01 18:14:02
39\t1\t101\tRajesh Kumar\t1\t0\t2026/09/02 09:49:00
40\t1\t102\tPriya Sharma\t1\t0\t2026/09/02 09:51:20
41\t1\t103\tAmit Patel\t1\t0\t2026/09/02 10:22:15
42\t1\t104\tSunita Verma\t1\t0\t2026/09/02 09:56:40
43\t1\t105\tVikram Singh\t1\t0\t2026/09/02 09:45:00
44\t1\t106\tAnanya Reddy\t1\t0\t2026/09/02 09:42:10
45\t1\t107\tMohammed Farooq\t1\t0\t2026/09/02 09:53:30
46\t1\t108\tKavita Nair\t1\t0\t2026/09/02 09:55:00
47\t1\t109\tSuresh Babu\t1\t0\t2026/09/02 09:58:15
48\t1\t101\tRajesh Kumar\t1\t0\t2026/09/02 09:49:00
000060\t1\t000000008\tmanisha\t1\t0\t2026/09/01 09:40:15
000061\t1\t000000008\tmanisha\t1\t0\t2026/09/01 18:02:10
000062\t1\t000000008\tmanisha\t1\t0\t2026/09/02 09:35:40`;
