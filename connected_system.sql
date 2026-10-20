-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 09, 2026 at 11:28 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `connected_system`
--

-- --------------------------------------------------------

--
-- Table structure for table `activity_log`
--

CREATE TABLE `activity_log` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `user_name` varchar(255) DEFAULT NULL,
  `user_role` varchar(20) DEFAULT NULL,
  `ACTION` varchar(100) NOT NULL,
  `target_type` varchar(50) DEFAULT NULL,
  `target_name` varchar(255) DEFAULT NULL,
  `details` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `activity_log`
--

INSERT INTO `activity_log` (`id`, `user_id`, `user_name`, `user_role`, `ACTION`, `target_type`, `target_name`, `details`, `created_at`) VALUES
(1, 1, 'System Admin', NULL, 'Updated teacher assignments', 'teacher', 'Teacher ID 5', NULL, '2026-08-14 06:26:10'),
(2, 1, 'System Admin', NULL, 'Deactivated account', 'user', 'User ID 5', NULL, '2026-08-14 06:26:26'),
(3, 1, 'System Admin', NULL, 'Deactivated account', 'user', 'User ID 4', NULL, '2026-08-14 07:03:36'),
(4, 1, 'System Admin', NULL, 'Created announcement', 'announcement', 'sgdf', 'Scope: school_wide', '2026-08-14 14:01:43'),
(5, 1, 'System Admin', NULL, 'Created announcement', 'announcement', 'frvrf', 'Scope: school_wide', '2026-08-14 14:04:22'),
(6, 1, 'System Admin', NULL, 'Created announcement', 'announcement', 'Exam Udma', 'Scope: school_wide', '2026-08-14 15:50:20'),
(7, 1, 'System Admin', NULL, 'Created account', 'teacher', 'Jane Doe', 'janedoe@usant.edu.ph', '2026-08-15 03:02:46'),
(8, 1, 'System Admin', NULL, 'Created account', 'teacher', 'John Doe', 'johndoe@usant.edu.ph', '2026-08-15 07:33:36'),
(9, 1, 'System Admin', NULL, 'Deactivated account', 'user', 'User ID 8', NULL, '2026-08-15 11:23:49'),
(10, 1, 'System Admin', NULL, 'Updated announcement', 'announcement', 'Exam Udma', 'Scope: school_wide', '2026-08-16 03:37:35'),
(11, 1, 'System Admin', NULL, 'Updated announcement', 'announcement', 'Exam Udma', 'Scope: school_wide', '2026-08-16 03:37:48'),
(12, 1, 'System Admin', NULL, 'Created announcement', 'announcement', 'dgfdgs', 'Scope: school_wide', '2026-08-16 03:38:02'),
(13, 1, 'System Admin', NULL, 'Deleted announcement', 'announcement', 'dgfdgs', NULL, '2026-08-16 03:45:22'),
(14, 1, 'System Admin', NULL, 'Updated announcement', 'announcement', 'Exam Udma', 'Scope: school_wide', '2026-08-16 03:52:53'),
(15, 1, 'System Admin', NULL, 'Deleted announcement', 'announcement', 'frvrf', NULL, '2026-08-16 08:10:11'),
(16, 1, 'System Admin', NULL, 'Created announcement', 'announcement', 'dd', 'Scope: school_wide', '2026-08-17 05:13:16'),
(17, 1, 'System Admin', NULL, 'Updated announcement', 'announcement', 'dd', 'Scope: school_wide', '2026-08-17 05:13:35'),
(18, 2, 'Agnes Cepe', 'teacher', 'Generated AI lesson resources', 'lesson_plan', 'Nouns and Verbs', 'provider=ollama', '2026-10-06 02:49:07'),
(19, 2, 'Agnes Cepe', 'teacher', 'Saved AI set to Classwork', 'question_bank', 'Nouns and Verbs Quiz', '11 created, set #1', '2026-10-06 02:49:13'),
(20, 2, 'Agnes Cepe', 'teacher', 'Created quiz from Classwork', 'assessment', 'Nouns and Verbs Quiz', 'Grade 1-A · 10 items', '2026-10-06 02:50:13'),
(21, 2, 'Agnes Cepe', 'teacher', 'Marked attendance', 'class', 'Grade 1-A', 'Cams Lasr: Present (AM)', '2026-10-06 02:50:23'),
(22, 2, 'Agnes Cepe', 'teacher', 'Assigned shared link', 'assessment', 'Nouns and Verbs Quiz', 'token=dedf01239e971b65', '2026-10-06 02:50:40'),
(23, 2, 'Agnes Cepe', 'teacher', 'Marked attendance', 'class', 'Grade 1-A', 'Cams Lasr: Present (PM)', '2026-10-07 15:18:25'),
(24, 2, 'Agnes Cepe', 'teacher', 'Updated progress scores', 'assessment', 'Nouns and Verbs Quiz', '1 score saved', '2026-10-07 15:19:16'),
(25, 2, 'Agnes Cepe', 'teacher', 'Generated AI lesson resources', 'lesson_plan', 'Nouns and Verbs', 'provider=mock', '2026-10-07 15:29:27'),
(26, 2, 'Agnes Cepe', 'teacher', 'Saved AI set to Classwork', 'question_bank', 'Quiz: Nouns and Verbs', '11 created, set #2', '2026-10-07 15:29:36'),
(27, 2, 'Agnes Cepe', 'teacher', 'Regenerated AI lesson resources', 'lesson_plan', 'Nouns and Verbs', 'provider=mock', '2026-10-07 15:29:49'),
(28, 2, 'Agnes Cepe', 'teacher', 'Created quiz from Classwork', 'assessment', 'Quiz: Nouns and Verbs', 'Grade 1-A · 10 items', '2026-10-07 15:30:08'),
(29, 2, 'Agnes Cepe', 'teacher', 'Created activity from Classwork', 'assessment', 'Activity — Nouns and Verbs', 'Grade 1-A · 1 items', '2026-10-07 15:30:19'),
(30, 2, 'Agnes Cepe', 'teacher', 'Assigned shared link', 'assessment', 'Quiz: Nouns and Verbs', 'token=4b073a3aaec36a14', '2026-10-07 15:30:27'),
(31, 2, 'Agnes Cepe', 'teacher', 'Marked attendance', 'class', 'Grade 1-A', 'Cams Lasr: Present (AM)', '2026-10-07 23:58:17'),
(32, 2, 'Agnes Cepe', 'teacher', 'Generated AI lesson resources', 'lesson_plan', 'Problem Solving', 'provider=mock', '2026-10-08 00:07:50'),
(33, 2, 'Agnes Cepe', 'teacher', 'Generated AI lesson resources', 'lesson_plan', 'Problem Solving', 'provider=mock', '2026-10-08 00:08:14'),
(34, 2, 'Agnes Cepe', 'teacher', 'Generated AI lesson resources', 'lesson_plan', 'Sample', 'provider=mock', '2026-10-08 00:08:38'),
(35, 2, 'Agnes Cepe', 'teacher', 'Generated AI lesson resources', 'lesson_plan', 'Sample', 'provider=mock', '2026-10-08 00:08:52'),
(36, 2, 'Agnes Cepe', 'teacher', 'Saved AI set to Classwork', 'question_bank', 'Quiz: Sample', '31 created, set #3', '2026-10-08 00:09:22'),
(37, 2, 'Agnes Cepe', 'teacher', 'Saved AI set to Classwork', 'question_bank', 'Quiz: Problem Solving', '11 created, set #4', '2026-10-08 00:10:33'),
(38, 2, 'Agnes Cepe', 'teacher', 'Created quiz from Classwork', 'assessment', 'Problem Solving', 'Grade 1-A · 10 items', '2026-10-08 00:11:09'),
(39, 2, 'Agnes Cepe', 'teacher', 'Assigned shared link', 'assessment', 'Problem Solving', 'token=6c412ed489a16b6a', '2026-10-08 00:11:16'),
(40, 2, 'Agnes Cepe', 'teacher', 'Updated progress scores', 'assessment', 'Problem Solving', '1 score saved', '2026-10-08 00:14:43'),
(41, 2, 'Agnes Cepe', 'teacher', 'Generated AI lesson resources', 'lesson_plan', 'Adjective', 'provider=mock', '2026-10-08 00:18:03'),
(42, 2, 'Agnes Cepe', 'teacher', 'Saved AI set to Classwork', 'question_bank', 'Quiz: Adjective', '31 created, set #5', '2026-10-08 00:18:10'),
(43, 2, 'Agnes Cepe', 'teacher', 'Generated AI lesson resources', 'lesson_plan', 'Internet of Things', 'provider=mock', '2026-10-08 00:19:49'),
(44, 2, 'Agnes Cepe', 'teacher', 'Saved AI set to Classwork', 'question_bank', 'Quiz: Internet of Things', '31 created, set #6', '2026-10-08 00:21:02'),
(45, 2, 'Agnes Cepe', 'teacher', 'Generated AI lesson resources', 'lesson_plan', 'Internet of Things', 'provider=mock', '2026-10-08 00:23:00'),
(46, 2, 'Agnes Cepe', 'teacher', 'Generated AI lesson resources', 'lesson_plan', 'Nouns and Verbs', 'provider=ollama', '2026-10-08 00:54:37'),
(47, 2, 'Agnes Cepe', 'teacher', 'Saved AI set to Classwork', 'question_bank', 'Nouns and Verbs Quiz', '11 created, set #7', '2026-10-08 01:01:56'),
(48, 2, 'Agnes Cepe', 'teacher', 'Saved grounded set to Classwork', 'question_bank', 'Quiz — Nouns', '8 items, set #8', '2026-10-08 05:52:01'),
(49, 1, 'System Admin', 'admin', 'Created account', 'parent', 'Good Parent', 'bulk-test-delete@usant.edu', '2026-10-08 07:19:31'),
(50, 1, 'System Admin', 'admin', 'Created account', 'parent', 'Sample Parent', 'sample.parent@usant.edu', '2026-10-08 07:28:12'),
(51, 1, 'System Admin', 'admin', 'Created account', 'parent', 'Sample Parent Two', 'sample.parent2@usant.edu', '2026-10-08 07:28:13'),
(52, 1, 'System Admin', 'admin', 'Created account', 'parent', 'Sample Parent Three', 'sample.parent3@usant.edu', '2026-10-08 07:28:13'),
(53, 1, 'System Admin', 'admin', 'Created account', 'teacher', 'Sample Teacher', 'sample.teacher@usant.edu', '2026-10-08 07:28:13'),
(54, 1, 'System Admin', 'admin', 'Created account', 'teacher', 'Sample Adviser', 'sample.adviser@usant.edu', '2026-10-08 07:28:13'),
(55, 1, 'System Admin', 'admin', 'Created account', 'teacher', 'Sample Subjects', 'sample.subjects@usant.edu', '2026-10-08 07:28:14'),
(56, 1, 'System Admin', 'admin', 'Created account', 'teacher', 'Argill TEacher', 'p2123@usant.edu.ph', '2026-10-08 07:33:08'),
(57, 1, 'System Admin', 'admin', 'Created announcement', 'announcement', 'Test', 'Scope: school_wide · Audience: everyone', '2026-10-08 08:14:28'),
(58, 1, 'System Admin', 'admin', 'Created announcement', 'announcement', 'Answer', 'Scope: school_wide · Audience: teachers', '2026-10-08 09:08:17'),
(59, 2, 'Agnes Cepe', 'teacher', 'Generated AI lesson resources', 'lesson_plan', 'Nouns', 'provider=ollama', '2026-10-08 10:18:00'),
(60, 2, 'Agnes Cepe', 'teacher', 'Marked attendance', 'class', 'Grade 1-A', 'Ben Reyes: Present (AM)', '2026-10-08 14:31:40'),
(61, 2, 'Agnes Cepe', 'teacher', 'Sent attendance update', 'class', 'Grade 1-A', '1 parent notice · SMS queued 1 · Present/Late/Absent', '2026-10-08 14:32:18'),
(62, 2, 'Agnes Cepe', 'teacher', 'Sent attendance update', 'class', 'Grade 1-A', '3 parent notices · SMS queued 3 · Present/Late/Absent', '2026-10-08 14:35:11'),
(63, 2, 'Agnes Cepe', 'teacher', 'Sent attendance update', 'class', 'Grade 1-A', '2 parent notices · SMS queued 2 · Present/Late/Absent', '2026-10-08 14:36:58'),
(64, 2, 'Agnes Cepe', 'teacher', 'Sent attendance update', 'class', 'Grade 1-A', '1 parent notice · SMS queued 1 · Late/Absent', '2026-10-08 14:38:53'),
(65, 2, 'Agnes Cepe', 'teacher', 'Sent attendance update', 'class', 'Grade 1-A', '2 parent notices · SMS queued 2 · Present/Late/Absent', '2026-10-08 14:42:35'),
(66, 2, 'Agnes Cepe', 'teacher', 'Marked attendance', 'class', 'Grade 1-A', 'Cams Lasr: Present (AM)', '2026-10-09 00:33:54'),
(67, 2, 'Agnes Cepe', 'teacher', 'Sent attendance update', 'class', 'Grade 1-A', '1 parent notice · SMS queued 1 · Present/Late/Absent', '2026-10-09 00:34:18'),
(68, 2, 'Agnes Cepe', 'teacher', 'Generated AI lesson resources', 'lesson_plan', 'Nouns', 'provider=ollama', '2026-10-09 00:46:54'),
(69, 2, 'Agnes Cepe', 'teacher', 'Saved AI set to Classwork', 'question_bank', 'Nouns Quiz', '11 created, set #9', '2026-10-09 00:50:41'),
(70, 2, 'Agnes Cepe', 'teacher', 'Created activity from Classwork', 'assessment', 'Activity — Nouns', 'Grade 1-A · 1 items', '2026-10-09 00:50:57'),
(71, 2, 'Agnes Cepe', 'teacher', 'Sent class notice', 'announcement', 'Exam', 'Grade 1-A', '2026-10-09 01:23:08'),
(72, 2, 'Agnes Cepe', 'teacher', 'Sent class notice', 'announcement', 'Sample', 'Grade 1-A', '2026-10-09 01:23:35'),
(73, 2, 'Agnes Cepe', 'teacher', 'Created quiz from Classwork', 'assessment', 'Nouns', 'Grade 1-A · 10 items', '2026-10-09 01:24:55'),
(74, 2, 'Agnes Cepe', 'teacher', 'Marked attendance', 'class', 'Grade 1-A', 'Ben Reyes: Present (AM)', '2026-10-09 01:25:34'),
(75, 2, 'Agnes Cepe', 'teacher', 'Assigned shared link', 'assessment', 'Nouns', 'token=b6711e7826711ab3', '2026-10-09 01:25:43'),
(76, 2, 'Agnes Cepe', 'teacher', 'Updated progress scores', 'assessment', 'Nouns', '1 score saved', '2026-10-09 01:26:52'),
(77, 2, 'Agnes Cepe', 'teacher', 'Sent attendance update', 'class', 'Grade 1-A', '1 parent notice · SMS queued 1 · Late/Absent', '2026-10-09 01:27:20'),
(78, 2, 'Agnes Cepe', 'teacher', 'Sent class notice', 'announcement', 'Exam', 'Grade 1-A', '2026-10-09 01:28:09'),
(79, 2, 'Agnes Cepe', 'teacher', 'Created quiz from Classwork', 'assessment', 'Quiz: Problem Solving', 'Grade 1-A · 10 items', '2026-10-09 01:29:59'),
(80, 2, 'Agnes Cepe', 'teacher', 'Assigned shared link', 'assessment', 'Quiz: Problem Solving', 'token=6218a1ba91db0ac6', '2026-10-09 01:30:05'),
(81, 2, 'Agnes Cepe', 'teacher', 'Updated progress scores', 'assessment', 'Activity — Nouns', '1 score saved', '2026-10-09 01:31:32'),
(82, 2, 'Agnes Cepe', 'teacher', 'Sent class notice', 'announcement', 'Kahit ano', 'Grade 1-A', '2026-10-09 01:33:43'),
(83, 2, 'Agnes Cepe', 'teacher', 'Created period exam from Classwork', 'assessment', 'Q1 Periodical Exam', 'Grade 1-A · 30 items', '2026-10-09 01:36:32'),
(84, 2, 'Agnes Cepe', 'teacher', 'Created period exam from Classwork', 'assessment', 'Q1 Periodical Exam', 'Grade 1-A · 28 items', '2026-10-09 01:37:02'),
(85, 2, 'Agnes Cepe', 'teacher', 'Assigned shared link', 'assessment', 'Q1 Periodical Exam', 'token=c6e44cd227513b8e', '2026-10-09 01:37:07'),
(86, 1, 'System Admin', 'admin', 'Activated account', 'user', 'User ID 5', NULL, '2026-10-09 02:31:13'),
(87, 1, 'System Admin', 'admin', 'Transferred classes and deactivated teacher', 'teacher', 'Sample Adviser', '1 class', '2026-10-09 02:35:28'),
(88, 1, 'System Admin', 'admin', 'Created account', 'teacher', 'Sample Lang', 'sample@usant.edu.ph', '2026-10-09 02:44:21'),
(89, 1, 'System Admin', 'admin', 'Transferred classes and deactivated teacher', 'teacher', 'Sample Lang', '4 classes', '2026-10-09 02:52:46'),
(90, 1, 'System Admin', 'admin', 'Transferred classes and deactivated teacher', 'teacher', 'Jobert Follero', '1 class', '2026-10-09 02:55:35'),
(91, 1, 'System Admin', 'admin', 'Transferred classes and deactivated teacher', 'teacher', 'Sample Subjects', '2 classes', '2026-10-09 02:57:18'),
(92, 1, 'System Admin', 'admin', 'Transferred classes and deactivated teacher', 'teacher', 'Sample Teacher', '1 class', '2026-10-09 03:01:42'),
(93, 1, 'System Admin', 'admin', 'Created account', 'teacher', 'Jen Tal', 'jen@usant.edu.ph', '2026-10-09 03:08:10'),
(94, 1, 'System Admin', 'admin', 'Transferred classes and deactivated teacher', 'teacher', 'Jen Tal', '2 classes', '2026-10-09 03:08:24'),
(95, 2, 'Agnes Cepe', 'teacher', 'Generated AI lesson resources', 'lesson_plan', 'Sample', 'provider=ollama', '2026-10-09 03:49:12'),
(96, 2, 'Agnes Cepe', 'teacher', 'Saved AI set to Classwork', 'question_bank', 'Understanding Nouns, Verbs, and Adjectives', '11 created, set #10', '2026-10-09 03:49:59'),
(97, 2, 'Agnes Cepe', 'teacher', 'Generated AI lesson resources', 'lesson_plan', 'Sample', 'provider=ollama', '2026-10-09 03:53:40'),
(98, 2, 'Agnes Cepe', 'teacher', 'Generated AI lesson resources', 'lesson_plan', 'Nouns', 'provider=ollama', '2026-10-09 04:38:15'),
(99, 2, 'Agnes Cepe', 'teacher', 'Generated AI lesson resources', 'lesson_plan', 'Nouns', 'provider=ollama', '2026-10-09 04:40:39'),
(100, 2, 'Agnes Cepe', 'teacher', 'Generated AI lesson resources', 'lesson_plan', 'Nouns', 'provider=ollama', '2026-10-09 04:44:17'),
(101, 2, 'Agnes Cepe', 'teacher', 'Saved AI set to Classwork', 'question_bank', 'Nouns Quiz', '4 created, set #11', '2026-10-09 04:44:30'),
(102, 1, 'System Admin', 'admin', 'Created account', 'parent', 'Argill Bonita', 'alexisbanana58@gmail.com', '2026-10-09 05:20:18'),
(103, 1, 'System Admin', 'admin', 'Deactivated account', 'user', 'User ID 21', NULL, '2026-10-09 05:21:45'),
(104, 1, 'System Admin', 'admin', 'Activated account', 'user', 'User ID 21', NULL, '2026-10-09 05:21:55'),
(105, 1, 'System Admin', 'admin', 'Deactivated account', 'user', 'User ID 21', NULL, '2026-10-09 05:21:58'),
(106, 1, 'System Admin', 'admin', 'Created account', 'parent', 'Argill Bonita', 'argillertbonita@gmail.com', '2026-10-09 05:22:28'),
(107, 1, 'System Admin', 'admin', 'Deactivated account', 'user', 'User ID 22', NULL, '2026-10-09 05:40:00'),
(108, 1, 'System Admin', 'admin', 'Created account', 'parent', 'Jobert Follero', 'bertofollero@gmail.com', '2026-10-09 05:40:34'),
(109, 1, 'System Admin', 'admin', 'Deactivated account', 'user', 'User ID 23', NULL, '2026-10-09 05:41:58'),
(110, 1, 'System Admin', 'admin', 'Updated account info', 'parent', 'Jobert Follero', 'berto@gmail.com', '2026-10-09 05:42:57'),
(111, 1, 'System Admin', 'admin', 'Created account', 'parent', 'Jobert Follero', 'bertofollero@gmail.com', '2026-10-09 05:43:23'),
(112, 1, 'System Admin', 'admin', 'Updated account info', 'parent', 'Jobert Follero', 'jobert@gmail.com', '2026-10-09 05:44:05'),
(113, 1, 'System Admin', 'admin', 'Created account', 'parent', 'Jobert Foll', 'bertofollero@gmail.com', '2026-10-09 05:44:34'),
(114, 1, 'System Admin', 'admin', 'Created account', 'parent', 'Cindy Beralde', 'cindyberalde@gmail.com', '2026-10-09 06:00:23'),
(115, 1, 'System Admin', 'admin', 'Updated account info', 'parent', 'Jobert Foll', 'follero@gmail.com', '2026-10-09 06:03:00'),
(116, 1, 'System Admin', 'admin', 'Created account', 'parent', 'Joe Fol', 'bertofollero@gmail.com', '2026-10-09 06:03:22'),
(117, 1, 'System Admin', 'admin', 'Created account', 'parent', 'Sunoo Quart', 'alexisbanana58@gmail.com', '2026-10-09 14:20:07'),
(118, 1, 'System Admin', 'admin', 'Created account', 'parent', 'Jen Talagtag', 'jennylyntalagtag780@gmail.com', '2026-10-09 15:43:31');

-- --------------------------------------------------------

--
-- Table structure for table `ai_recommendations`
--

CREATE TABLE `ai_recommendations` (
  `id` int(11) NOT NULL,
  `lesson_plan_id` int(11) NOT NULL,
  `teacher_id` int(11) NOT NULL,
  `subject_id` int(11) DEFAULT NULL,
  `grade_level` int(11) NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `provider` varchar(32) NOT NULL DEFAULT 'mock',
  `source_excerpt` text DEFAULT NULL,
  `content` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`content`)),
  `assessment_id` int(11) DEFAULT NULL,
  `approved_type` varchar(20) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `ai_recommendations`
--

INSERT INTO `ai_recommendations` (`id`, `lesson_plan_id`, `teacher_id`, `subject_id`, `grade_level`, `status`, `provider`, `source_excerpt`, `content`, `assessment_id`, `approved_type`, `created_at`, `updated_at`) VALUES
(4, 2, 2, 12, 1, 'pending', 'mock', 'Lesson title: Problem Solving\n\nLesson plan excerpt:\nINTERNET OF THINGS NOEL V. PAGUIO JR. WHAT IS INTERNET OF THINGS? •TheInternet of Things (IoT)refers toa network of physical objects \"things“ embedded with sensors, software, and technologies that enable them to connect, collect, and exchange data with other devices and systems over the internet or networks. These smart, interconnected devices range from household appliances to industrial tools, automating tasks and enabling remote monitoring and, in many cases, autonomous operation. IoT enhances operational efficiency and decision-making by allowing for real-time data analysis and automation without manual intervention. KEY ASPECTS OF IOT •Components: IoT systems combine physical devices (sensors/actuators), internet/network connectivity, data processing, and user interfaces. •Functionality: They collect data from their environment, transmit it, and often act on it to improve efficiency, convenience, or automation. •Examples: Smart thermostats, connected vehicles, wearable fitness trackers, smart home security systems, and industrial sensors. •Applications: Commonly used for smart homes, healthcare, industrial IoT and smart cities. MICROCONTROLLERS •A microcontroller (MCU) isa small, self-contained computer on a single chip, integrating a processor, memory (RAM, ROM/Flash), and programmable input/output (I/O) peripherals, designed to execute specific tasks inembedded systemslike home appliances, cars, and IoT devices WHAT’S INSIDE A MICROCONTROLLER? WHAT’S INSIDE A MICROCONTROLLER? •CPU –runs your program •Memory –stores code and variables •Input/Output pins (GPIO) –talk to the outside world •Timers / counters •Peripherals –ADC (analog reading), UART, I²C, SPI, PWM, etc. WHATITISNOT(MICROCONTROLLERS) •Not a PC •No keyboard, mouse, monitor, or operating system (usually) •Not meant for multitasking heavy apps It runs one dedicated job, usually forever, in a loop. WHERE CAN YOU FIND MICROCONTROLLERS? •Washing machine', '{\"quiz\":{\"title\":\"Quiz: Problem Solving\",\"max_score\":10,\"items\":[{\"type\":\"mcq\",\"question\":\"What is the main idea of \\\"Problem Solving\\\" for Grade 1 Mathematics?\",\"choices\":[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"],\"answer\":\"A key concept from the lesson\",\"points\":1},{\"type\":\"mcq\",\"question\":\"Which statement best shows understanding of Problem Solving?\",\"choices\":[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"],\"answer\":\"A key concept from the lesson\",\"points\":1},{\"type\":\"mcq\",\"question\":\"Based on the objectives, students should practice Problem Solving by:\",\"choices\":[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"],\"answer\":\"A key concept from the lesson\",\"points\":1},{\"type\":\"mcq\",\"question\":\"Based on the objectives, students should practice Problem Solving by:\",\"choices\":[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"],\"answer\":\"A key concept from the lesson\",\"points\":1},{\"type\":\"identification\",\"question\":\"Identify one important term from the lesson \\\"Problem Solving\\\".\",\"choices\":null,\"answer\":\"Key term from Problem Solving\",\"points\":1},{\"type\":\"identification\",\"question\":\"Name the main skill practiced in \\\"Problem Solving\\\" (Mathematics).\",\"choices\":null,\"answer\":\"Skill from Problem Solving\",\"points\":1},{\"type\":\"identification\",\"question\":\"Name the main skill practiced in \\\"Problem Solving\\\" (Mathematics).\",\"choices\":null,\"answer\":\"Skill from Problem Solving\",\"points\":1},{\"type\":\"enumeration\",\"question\":\"List 2–3 things you learned about \\\"Problem Solving\\\".\",\"choices\":null,\"answer\":\"Possible answers: concepts or steps from the lesson objectives\",\"points\":2},{\"type\":\"enumeration\",\"question\":\"Enumerate steps or examples related to \\\"Problem Solving\\\" for Grade 1.\",\"choices\":null,\"answer\":\"Possible answers: concepts or steps from the lesson objectives\",\"points\":2},{\"type\":\"enumeration\",\"question\":\"Enumerate steps or examples related to \\\"Problem Solving\\\" for Grade 1.\",\"choices\":null,\"answer\":\"Possible answers: concepts or steps from the lesson objectives\",\"points\":2}],\"notes\":\"Mock draft (10 items). Save to Classwork, then pick items for Progress.\"},\"activity\":{\"title\":\"Activity: Explore Problem Solving\",\"max_score\":10,\"description\":\"Students work in pairs on a short Grade 1 task about \\\"Problem Solving\\\" (Mathematics). They write or draw examples, share with a partner, then present one idea.\",\"notes\":\"Generated from lesson title/objectives (and file text if available).\",\"rubric\":{\"categories\":[{\"name\":\"Participation\",\"max_points\":4,\"levels\":[{\"label\":\"Excellent\",\"points\":4,\"description\":\"Fully engaged; helps partner; stays on task.\"},{\"label\":\"Good\",\"points\":3,\"description\":\"Mostly engaged with little prompting.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Needs reminders to stay on task.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Rarely participates or off-task.\"}]},{\"name\":\"Correctness\",\"max_points\":3,\"levels\":[{\"label\":\"Excellent\",\"points\":3,\"description\":\"Ideas clearly match the lesson.\"},{\"label\":\"Good\",\"points\":2,\"description\":\"Mostly accurate with small gaps.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Partial understanding shown.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Little connection to the lesson.\"}]},{\"name\":\"Effort\",\"max_points\":3,\"levels\":[{\"label\":\"Excellent\",\"points\":3,\"description\":\"Complete, neat, thoughtful work.\"},{\"label\":\"Good\",\"points\":2,\"description\":\"Complete with adequate care.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Incomplete or rushed.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Minimal effort.\"}]}]}},\"exam\":null}', NULL, NULL, '2026-10-08 00:08:14', '2026-10-08 00:08:14'),
(13, 3, 2, 13, 1, 'pending', 'ollama', 'Lesson title: Sample\n\nLesson plan excerpt:\nUse of Nouns, Verbs, and Adjectives Nouns, verbs, and adjectives are parts of speech, or the building blocks for writing complete sentences. Nouns are people, places, or things. Verbs are action words. Adjectives are descriptive words. Nouns  A noun is a part of speech that signifies a person, place, or thing. Example 1: The rabbit read the book. Example 2: Anna visited France. Both “rabbit” and “book” are nouns because they are “things.” They are general words for people, places, or things, so they are improper nouns. “Anna” is a noun because she is a person, and “France” is a noun because it’s a place. Anna is the girl’s name and France is the name of a country, so they are proper nouns.  The previous examples are tangible nouns, or things you can touch or hold, but nouns can also be intangible or abstract. This means that they aren’t things you can touch, like feelings. Example 1: Honesty is important. Example 2: He is searching for happiness. “Honesty” and “happiness” are concepts that are more abstract than “rabbit” or “book,” but they are both still nouns.  Nouns can also be singular or plural. Singular nouns refer to only one person, place or thing, and plural nouns refer to more than one. Example 1: She owns a dog. Example 2: She owns two dogs. There is only one dog in the first example, so the noun “dog” remains unchanged. To show that there are multiple dogs, an “s” is added to the end of “dog” to make it plural. Pronouns  Pronouns are words that replace nouns in a sentence. In the following examples, the first example does not have a pronoun and the second one does. Example 1: Jasmine is a princess. Example 2: She is a princess. “She” is a pronoun used to replace the proper noun “Jasmine.”  Example pronouns: Subject Pronouns Object Pronouns I Me We Us You You She Her He Him It It They Them Adjectives  Adjectives describe nouns. They tell us which, what kind, or how many of a certain noun there is. An adject', '{\"quiz\":{\"title\":\"Understanding Nouns, Verbs, and Adjectives\",\"max_score\":10,\"items\":[{\"type\":\"mcq\",\"question\":\"What is a noun?\",\"choices\":[\"A person, place, or thing\",\"A verb\",\"An adjective\",\"A pronoun\"],\"answer\":\"A person, place, or thing\",\"points\":1},{\"type\":\"mcq\",\"question\":\"What is a verb?\",\"choices\":[\"An action word\",\"A descriptive word\",\"A pronoun\",\"An adjective\"],\"answer\":\"An action word\",\"points\":1},{\"type\":\"mcq\",\"question\":\"What is an adjective?\",\"choices\":[\"A word that describes a noun\",\"A word that modifies a verb\",\"A word that is a pronoun\",\"A word that is an adverb\"],\"answer\":\"A word that describes a noun\",\"points\":1},{\"type\":\"mcq\",\"question\":\"What type of noun refers to only one person, place, or thing?\",\"choices\":[\"Proper\",\"Common\",\"Singular\",\"Plural\"],\"answer\":\"Singular\",\"points\":1},{\"type\":\"mcq\",\"question\":\"What type of noun refers to more than one person, place, or thing?\",\"choices\":[\"Proper\",\"Common\",\"Singular\",\"Plural\"],\"answer\":\"Plural\",\"points\":1},{\"type\":\"mcq\",\"question\":\"What is a pronoun?\",\"choices\":[\"A word that replaces a noun\",\"A word that modifies a verb\",\"A word that is an adjective\",\"A word that is an adverb\"],\"answer\":\"A word that replaces a noun\",\"points\":1},{\"type\":\"mcq\",\"question\":\"What type of word describes a noun?\",\"choices\":[\"Adjective\",\"Adverb\",\"Pronoun\",\"Verb\"],\"answer\":\"Adjective\",\"points\":1},{\"type\":\"mcq\",\"question\":\"What type of word modifies a verb?\",\"choices\":[\"Adjective\",\"Adverb\",\"Pronoun\",\"Verb\"],\"answer\":\"Adverb\",\"points\":1},{\"type\":\"mcq\",\"question\":\"What is a helping verb?\",\"choices\":[\"A verb that helps to extend the meaning of another verb\",\"A verb that modifies a noun\",\"A verb that is an adjective\",\"A verb that is an adverb\"],\"answer\":\"A verb that helps to extend the meaning of another verb\",\"points\":1},{\"type\":\"mcq\",\"question\":\"What is an adverb?\",\"choices\":[\"A word that modifies a verb\",\"A word that modifies an adjective\",\"A word that is a pronoun\",\"A word that is a noun\"],\"answer\":\"A word that modifies a verb\",\"points\":1}],\"notes\":\"Remember to identify the parts of speech in sentences to understand their meaning.\"},\"activity\":{\"title\":\"Sorting Game\",\"max_score\":5,\"description\":\"Sort the following words into their correct categories: noun, verb, adjective, pronoun, and adverb. Use the definitions provided to help you make your decisions.\",\"notes\":\"This activity will help students practice identifying the parts of speech in sentences.\",\"rubric\":{\"categories\":[{\"name\":\"Accuracy\",\"max_points\":5,\"levels\":[{\"label\":\"Excellent\",\"points\":5,\"description\":\"All words are correctly sorted into their categories.\"},{\"label\":\"Good\",\"points\":3,\"description\":\"Most words are correctly sorted, but some may be misplaced.\"},{\"label\":\"Fair\",\"points\":1,\"description\":\"Some words are correctly sorted, but many are misplaced.\"},{\"label\":\"Needs Improvement\",\"points\":0,\"description\":\"Most words are incorrectly sorted.\"}]}]}},\"exam\":null}', NULL, NULL, '2026-10-09 03:49:12', '2026-10-09 03:49:12'),
(15, 6, 2, 16, 1, 'pending', 'ollama', 'Lesson title: Nouns\n\nLesson plan excerpt:\nUse of Nouns, Verbs, and Adjectives Nouns, verbs, and adjectives are parts of speech, or the building blocks for writing complete sentences. Nouns are people, places, or things. Verbs are action words. Adjectives are descriptive words. Nouns  A noun is a part of speech that signifies a person, place, or thing. Example 1: The rabbit read the book. Example 2: Anna visited France. Both “rabbit” and “book” are nouns because they are “things.” They are general words for people, places, or things, so they are improper nouns. “Anna” is a noun because she is a person, and “France” is a noun because it’s a place. Anna is the girl’s name and France is the name of a country, so they are proper nouns.  The previous examples are tangible nouns, or things you can touch or hold, but nouns can also be intangible or abstract. This means that they aren’t things you can touch, like feelings. Example 1: Honesty is important. Example 2: He is searching for happiness. “Honesty” and “happiness” are concepts that are more abstract than “rabbit” or “book,” but they are both still nouns.  Nouns can also be singular or plural. Singular nouns refer to only one person, place or thing, and plural nouns refer to more than one. Example 1: She owns a dog. Example 2: She owns two dogs. There is only one dog in the first example, so the noun “dog” remains unchanged. To show that there are multiple dogs, an “s” is added to the end of “dog” to make it plural. Pronouns  Pronouns are words that replace nouns in a sentence. In the following examples, the first example does not have a pronoun and the second one does. Example 1: Jasmine is a princess. Example 2: She is a princess. “She” is a pronoun used to replace the proper noun “Jasmine.”  Example pronouns: Subject Pronouns Object Pronouns I Me We Us You You She Her He Him It It They Them Adjectives  Adjectives describe nouns. They tell us which, what kind, or how many of a certain noun there is. An adjecti', '{\"quiz\":{\"title\":\"Nouns Quiz\",\"max_score\":10,\"items\":[{\"type\":\"mcq\",\"question\":\"What is a type of noun that refers to a person, place, or thing that can be touched or held?\",\"choices\":[\"Abstract noun\",\"Proper noun\",\"Common noun\",\"Tangible noun\"],\"answer\":\"Tangible noun\",\"points\":1},{\"type\":\"mcq\",\"question\":\"What is the function of pronouns in a sentence?\",\"choices\":[\"To modify adjectives\",\"To describe nouns\",\"To replace nouns\",\"To introduce adverbs\"],\"answer\":\"To replace nouns\",\"points\":1},{\"type\":\"mcq\",\"question\":\"What is an adjective that describes how someone or something looks?\",\"choices\":[\"Descriptive adjective\",\"Comparative adjective\",\"Superlative adjective\",\"Quantitative adjective\"],\"answer\":\"Descriptive adjective\",\"points\":1},{\"type\":\"mcq\",\"question\":\"What is the verb that helps to extend the meaning of another verb in a sentence?\",\"choices\":[\"Action verb\",\"Helping verb\",\"Auxiliary verb\",\"Modal verb\"],\"answer\":\"Helping verb\",\"points\":1},{\"type\":\"mcq\",\"question\":\"What is the function of adverbs in a sentence?\",\"choices\":[\"To modify verbs\",\"To describe nouns\",\"To introduce adjectives\",\"To replace pronouns\"],\"answer\":\"To modify verbs\",\"points\":1},{\"type\":\"mcq\",\"question\":\"What is a type of noun that refers to a person, place, or thing that is a specific, unique entity?\",\"choices\":[\"Proper noun\",\"Common noun\",\"Abstract noun\",\"Tangible noun\"],\"answer\":\"Proper noun\",\"points\":1},{\"type\":\"mcq\",\"question\":\"What is an adjective that describes how many of a certain noun there is?\",\"choices\":[\"Quantitative adjective\",\"Descriptive adjective\",\"Comparative adjective\",\"Superlative adjective\"],\"answer\":\"Quantitative adjective\",\"points\":1},{\"type\":\"mcq\",\"question\":\"What is the function of adjectives in a sentence?\",\"choices\":[\"To modify nouns\",\"To describe verbs\",\"To introduce pronouns\",\"To replace adverbs\"],\"answer\":\"To modify nouns\",\"points\":1},{\"type\":\"mcq\",\"question\":\"What is the verb that describes an action or state of being in a sentence?\",\"choices\":[\"Action verb\",\"Helping verb\",\"Auxiliary verb\",\"Modal verb\"],\"answer\":\"Action verb\",\"points\":1},{\"type\":\"mcq\",\"question\":\"What is an adverb that describes how an action or state of being was done?\",\"choices\":[\"Descriptive adverb\",\"Comparative adverb\",\"Superlative adverb\",\"Quantitative adverb\"],\"answer\":\"Descriptive adverb\",\"points\":1}],\"notes\":\"Mock draft (10 items). Save to Classwork, then pick items for Progress.\"},\"activity\":{\"title\":\"Activity: Explore Nouns\",\"max_score\":10,\"description\":\"Students work in pairs on a short Grade 1 task about \\\"Nouns\\\" (English). They write or draw examples, share with a partner, then present one idea.\",\"notes\":\"Generated from lesson title/objectives (and file text if available).\",\"rubric\":{\"categories\":[{\"name\":\"Participation\",\"max_points\":4,\"levels\":[{\"label\":\"Excellent\",\"points\":4,\"description\":\"Fully engaged; helps partner; stays on task.\"},{\"label\":\"Good\",\"points\":3,\"description\":\"Mostly engaged with little prompting.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Needs reminders to stay on task.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Rarely participates or off-task.\"}]},{\"name\":\"Correctness\",\"max_points\":3,\"levels\":[{\"label\":\"Excellent\",\"points\":3,\"description\":\"Ideas clearly match the lesson.\"},{\"label\":\"Good\",\"points\":2,\"description\":\"Mostly accurate with small gaps.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Partial understanding shown.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Little connection to the lesson.\"}]},{\"name\":\"Effort\",\"max_points\":3,\"levels\":[{\"label\":\"Excellent\",\"points\":3,\"description\":\"Complete, neat, thoughtful work.\"},{\"label\":\"Good\",\"points\":2,\"description\":\"Complete with adequate care.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Incomplete or rushed.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Minimal effort.\"}]}]}},\"exam\":null}', NULL, NULL, '2026-10-09 04:38:15', '2026-10-09 04:38:15'),
(16, 6, 2, 16, 1, 'pending', 'ollama', 'Lesson title: Nouns\n\nLesson plan excerpt:\nUse of Nouns, Verbs, and Adjectives Nouns, verbs, and adjectives are parts of speech, or the building blocks for writing complete sentences. Nouns are people, places, or things. Verbs are action words. Adjectives are descriptive words. Nouns  A noun is a part of speech that signifies a person, place, or thing. Example 1: The rabbit read the book. Example 2: Anna visited France. Both “rabbit” and “book” are nouns because they are “things.” They are general words for people, places, or things, so they are improper nouns. “Anna” is a noun because she is a person, and “France” is a noun because it’s a place. Anna is the girl’s name and France is the name of a country, so they are proper nouns.  The previous examples are tangible nouns, or things you can touch or hold, but nouns can also be intangible or abstract. This means that they aren’t things you can touch, like feelings. Example 1: Honesty is important. Example 2: He is searching for happiness. “Honesty” and “happiness” are concepts that are more abstract than “rabbit” or “book,” but they are both still nouns.  Nouns can also be singular or plural. Singular nouns refer to only one person, place or thing, and plural nouns refer to more than one. Example 1: She owns a dog. Example 2: She owns two dogs. There is only one dog in the first example, so the noun “dog” remains unchanged. To show that there are multiple dogs, an “s” is added to the end of “dog” to make it plural. Pronouns  Pronouns are words that replace nouns in a sentence. In the following examples, the first example does not have a pronoun and the second one does. Example 1: Jasmine is a princess. Example 2: She is a princess. “She” is a pronoun used to replace the proper noun “Jasmine.”  Example pronouns: Subject Pronouns Object Pronouns I Me We Us You You She Her He Him It It They Them Adjectives  Adjectives describe nouns. They tell us which, what kind, or how many of a certain noun there is. An adjecti', '{\"quiz\":{\"title\":\"Nouns Quiz\",\"max_score\":10,\"items\":[{\"type\":\"identification\",\"question\":\"What is the part of speech that signifies a person, place, or thing?\",\"answer\":\"A noun\",\"points\":1},{\"type\":\"identification\",\"question\":\"What is the name of the country in the example \\\"Anna visited France\\\"?\",\"answer\":\"France\",\"points\":1},{\"type\":\"identification\",\"question\":\"What is the term for words that replace nouns in a sentence?\",\"answer\":\"Pronouns\",\"points\":1},{\"type\":\"identification\",\"question\":\"What is the part of speech that modifies a noun?\",\"answer\":\"An adjective\",\"points\":1},{\"type\":\"identification\",\"question\":\"What is the name of the girl in the example \\\"Jasmine is a princess\\\"?\",\"answer\":\"Jasmine\",\"points\":1},{\"type\":\"identification\",\"question\":\"What is the term for words that describe how verbs, or actions, were done?\",\"answer\":\"Adverbs\",\"points\":1},{\"type\":\"identification\",\"question\":\"What is the name of the superhero in the example \\\"Batman drives the Batmobile\\\"?\",\"answer\":\"Batman\",\"points\":1},{\"type\":\"identification\",\"question\":\"What is the term for words that replace the objects in a sentence that are receiving action?\",\"answer\":\"Object pronouns\",\"points\":1},{\"type\":\"identification\",\"question\":\"What is the term for words that describe the state of being in a sentence?\",\"answer\":\"Verbs\",\"points\":1},{\"type\":\"identification\",\"question\":\"What is the name of the spy in the example \\\"Natasha is a spy\\\"?\",\"answer\":\"Natasha\",\"points\":1}],\"notes\":\"Mock draft (10 items). Save to Classwork, then pick items for Progress.\"},\"activity\":{\"title\":\"Activity: Explore Nouns\",\"max_score\":10,\"description\":\"Students work in pairs on a short Grade 1 task about \\\"Nouns\\\" (English). They write or draw examples, share with a partner, then present one idea.\",\"notes\":\"Generated from lesson title/objectives (and file text if available).\",\"rubric\":{\"categories\":[{\"name\":\"Participation\",\"max_points\":4,\"levels\":[{\"label\":\"Excellent\",\"points\":4,\"description\":\"Fully engaged; helps partner; stays on task.\"},{\"label\":\"Good\",\"points\":3,\"description\":\"Mostly engaged with little prompting.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Needs reminders to stay on task.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Rarely participates or off-task.\"}]},{\"name\":\"Correctness\",\"max_points\":3,\"levels\":[{\"label\":\"Excellent\",\"points\":3,\"description\":\"Ideas clearly match the lesson.\"},{\"label\":\"Good\",\"points\":2,\"description\":\"Mostly accurate with small gaps.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Partial understanding shown.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Little connection to the lesson.\"}]},{\"name\":\"Effort\",\"max_points\":3,\"levels\":[{\"label\":\"Excellent\",\"points\":3,\"description\":\"Complete, neat, thoughtful work.\"},{\"label\":\"Good\",\"points\":2,\"description\":\"Complete with adequate care.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Incomplete or rushed.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Minimal effort.\"}]}]}},\"exam\":null}', NULL, NULL, '2026-10-09 04:40:39', '2026-10-09 04:40:39'),
(17, 6, 2, 16, 1, 'pending', 'ollama', 'Lesson title: Nouns\n\nLesson plan excerpt:\nUse of Nouns, Verbs, and Adjectives Nouns, verbs, and adjectives are parts of speech, or the building blocks for writing complete sentences. Nouns are people, places, or things. Verbs are action words. Adjectives are descriptive words. Nouns  A noun is a part of speech that signifies a person, place, or thing. Example 1: The rabbit read the book. Example 2: Anna visited France. Both “rabbit” and “book” are nouns because they are “things.” They are general words for people, places, or things, so they are improper nouns. “Anna” is a noun because she is a person, and “France” is a noun because it’s a place. Anna is the girl’s name and France is the name of a country, so they are proper nouns.  The previous examples are tangible nouns, or things you can touch or hold, but nouns can also be intangible or abstract. This means that they aren’t things you can touch, like feelings. Example 1: Honesty is important. Example 2: He is searching for happiness. “Honesty” and “happiness” are concepts that are more abstract than “rabbit” or “book,” but they are both still nouns.  Nouns can also be singular or plural. Singular nouns refer to only one person, place or thing, and plural nouns refer to more than one. Example 1: She owns a dog. Example 2: She owns two dogs. There is only one dog in the first example, so the noun “dog” remains unchanged. To show that there are multiple dogs, an “s” is added to the end of “dog” to make it plural. Pronouns  Pronouns are words that replace nouns in a sentence. In the following examples, the first example does not have a pronoun and the second one does. Example 1: Jasmine is a princess. Example 2: She is a princess. “She” is a pronoun used to replace the proper noun “Jasmine.”  Example pronouns: Subject Pronouns Object Pronouns I Me We Us You You She Her He Him It It They Them Adjectives  Adjectives describe nouns. They tell us which, what kind, or how many of a certain noun there is. An adjecti', '{\"quiz\":{\"title\":\"Nouns Quiz\",\"max_score\":5,\"items\":[{\"type\":\"mcq\",\"question\":\"What is a general word for a person, place, or thing?\",\"choices\":[\"A proper noun\",\"A singular noun\",\"A plural noun\",\"A general word for people, places, or things\"],\"answer\":\"A general word for people, places, or things\",\"points\":1},{\"type\":\"identification\",\"question\":\"Name one type of noun that refers to a tangible or touchable thing.\",\"answer\":\"Tangible noun\",\"points\":1},{\"type\":\"enumeration\",\"question\":\"List three types of nouns.\",\"answer\":\"Proper nouns, Common nouns, Abstract nouns\",\"points\":3}],\"notes\":\"Mock draft (20 items). Save to Classwork, then pick items for Progress.\"},\"activity\":{\"title\":\"Activity: Explore Nouns\",\"max_score\":10,\"description\":\"Students work in pairs on a short Grade 1 task about \\\"Nouns\\\" (English). They write or draw examples, share with a partner, then present one idea.\",\"notes\":\"Generated from lesson title/objectives (and file text if available).\",\"rubric\":{\"categories\":[{\"name\":\"Participation\",\"max_points\":4,\"levels\":[{\"label\":\"Excellent\",\"points\":4,\"description\":\"Fully engaged; helps partner; stays on task.\"},{\"label\":\"Good\",\"points\":3,\"description\":\"Mostly engaged with little prompting.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Needs reminders to stay on task.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Rarely participates or off-task.\"}]},{\"name\":\"Correctness\",\"max_points\":3,\"levels\":[{\"label\":\"Excellent\",\"points\":3,\"description\":\"Ideas clearly match the lesson.\"},{\"label\":\"Good\",\"points\":2,\"description\":\"Mostly accurate with small gaps.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Partial understanding shown.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Little connection to the lesson.\"}]},{\"name\":\"Effort\",\"max_points\":3,\"levels\":[{\"label\":\"Excellent\",\"points\":3,\"description\":\"Complete, neat, thoughtful work.\"},{\"label\":\"Good\",\"points\":2,\"description\":\"Complete with adequate care.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Incomplete or rushed.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Minimal effort.\"}]}]}},\"exam\":null}', NULL, NULL, '2026-10-09 04:44:17', '2026-10-09 04:44:17');

-- --------------------------------------------------------

--
-- Table structure for table `announcements`
--

CREATE TABLE `announcements` (
  `id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `sender_id` int(11) NOT NULL,
  `scope` enum('school_wide','grade_wide','class_specific') DEFAULT 'school_wide',
  `target_grade` int(11) DEFAULT NULL,
  `target_section` varchar(10) DEFAULT NULL,
  `priority` enum('low','normal','high','urgent') DEFAULT 'normal',
  `audience` enum('teachers','everyone') NOT NULL DEFAULT 'everyone',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL,
  `admin_id` int(11) DEFAULT NULL,
  `body` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `announcements`
--

INSERT INTO `announcements` (`id`, `title`, `content`, `sender_id`, `scope`, `target_grade`, `target_section`, `priority`, `audience`, `created_at`, `updated_at`, `admin_id`, `body`) VALUES
(4, 'sgdf', '', 1, 'school_wide', NULL, NULL, 'normal', 'everyone', '2026-08-14 14:01:43', NULL, NULL, 'sdfcs'),
(6, 'Exam Udma', '', 1, 'school_wide', NULL, NULL, 'high', 'everyone', '2026-08-14 15:50:20', '2026-08-16 03:52:53', NULL, 'Mag review!!!!!'),
(8, 'dd', '', 1, 'school_wide', NULL, NULL, 'normal', 'everyone', '2026-08-17 05:13:16', '2026-08-17 05:13:35', NULL, 'dds yan sya'),
(9, 'Test', '', 1, 'school_wide', NULL, NULL, 'normal', 'everyone', '2026-10-08 08:14:28', NULL, NULL, 'Test'),
(12, 'Answer', '', 1, 'school_wide', NULL, NULL, 'high', 'teachers', '2026-10-08 09:08:17', NULL, NULL, 'Please answer the given questions.'),
(13, 'Exam', '', 2, 'class_specific', 1, 'A', 'normal', 'everyone', '2026-10-09 01:23:08', NULL, NULL, 'mag review na'),
(14, 'Sample', '', 2, 'class_specific', 1, 'A', 'normal', 'everyone', '2026-10-09 01:23:35', NULL, NULL, 'sample lang'),
(15, 'Exam', '', 2, 'class_specific', 1, 'A', 'normal', 'everyone', '2026-10-09 01:28:09', NULL, NULL, 'mag review na!!'),
(16, 'Kahit ano', '', 2, 'class_specific', 1, 'A', 'normal', 'everyone', '2026-10-09 01:33:43', NULL, NULL, 'okay lang');

-- --------------------------------------------------------

--
-- Table structure for table `announcement_reads`
--

CREATE TABLE `announcement_reads` (
  `user_id` int(11) NOT NULL,
  `announcement_id` int(11) NOT NULL,
  `read_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `announcement_reads`
--

INSERT INTO `announcement_reads` (`user_id`, `announcement_id`, `read_at`) VALUES
(1, 4, '2026-08-16 04:02:03'),
(1, 6, '2026-08-16 08:10:06'),
(1, 8, '2026-08-17 05:13:22'),
(2, 4, '2026-08-16 03:51:54'),
(2, 6, '2026-08-16 08:11:35'),
(2, 8, '2026-10-09 00:34:57'),
(2, 9, '2026-10-09 00:34:57'),
(2, 12, '2026-10-09 00:34:57'),
(2, 13, '2026-10-09 01:48:14'),
(2, 14, '2026-10-09 01:48:14'),
(2, 15, '2026-10-09 01:48:14'),
(2, 16, '2026-10-09 01:48:14'),
(3, 4, '2026-10-06 02:59:33'),
(3, 6, '2026-10-06 02:59:33'),
(3, 8, '2026-10-06 02:59:33'),
(3, 9, '2026-10-09 01:48:40'),
(3, 13, '2026-10-09 01:25:16'),
(3, 14, '2026-10-09 01:25:16'),
(19, 4, '2026-10-09 02:54:10'),
(19, 6, '2026-10-09 02:54:10'),
(19, 8, '2026-10-09 02:54:10'),
(19, 9, '2026-10-09 02:54:10'),
(19, 12, '2026-10-09 02:54:10');

-- --------------------------------------------------------

--
-- Table structure for table `app_settings`
--

CREATE TABLE `app_settings` (
  `setting_key` varchar(64) NOT NULL,
  `setting_value` varchar(255) NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `app_settings`
--

INSERT INTO `app_settings` (`setting_key`, `setting_value`, `updated_at`) VALUES
('current_quarter', 'Q1', '2026-10-05 14:42:07');

-- --------------------------------------------------------

--
-- Table structure for table `assessments`
--

CREATE TABLE `assessments` (
  `id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `TYPE` enum('quiz','activity','exam') NOT NULL,
  `subject_id` int(11) DEFAULT NULL,
  `grade_level` int(11) NOT NULL,
  `section` varchar(10) NOT NULL,
  `max_score` int(11) DEFAULT 100,
  `quarter` varchar(10) DEFAULT 'Q1',
  `quiz_link` varchar(500) DEFAULT NULL,
  `share_token` varchar(32) DEFAULT NULL,
  `share_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `quiz_attendance_date` date DEFAULT NULL,
  `quiz_attendance_session` varchar(2) DEFAULT 'AM',
  `quiz_subject_id` int(11) DEFAULT NULL,
  `quiz_makeup_student_ids` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`quiz_makeup_student_ids`)),
  `quiz_closes_at` datetime DEFAULT NULL,
  `quiz_makeup_closes_at` datetime DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `lesson_plan_id` int(11) DEFAULT NULL,
  `lesson_title` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `assessments`
--

INSERT INTO `assessments` (`id`, `title`, `TYPE`, `subject_id`, `grade_level`, `section`, `max_score`, `quarter`, `quiz_link`, `share_token`, `share_enabled`, `quiz_attendance_date`, `quiz_attendance_session`, `quiz_subject_id`, `quiz_makeup_student_ids`, `quiz_closes_at`, `quiz_makeup_closes_at`, `created_by`, `created_at`, `lesson_plan_id`, `lesson_title`) VALUES
(1, 'Nouns and Verbs Quiz', 'quiz', 16, 1, 'A', 10, 'Q1', NULL, 'dedf01239e971b65', 1, '2026-10-06', 'AM', NULL, '[]', '2026-10-06 11:50:40', NULL, 2, '2026-10-06 02:50:13', 1, 'Nouns and Verbs'),
(2, 'Quiz: Nouns and Verbs', 'quiz', 16, 1, 'A', 13, 'Q1', NULL, '4b073a3aaec36a14', 1, '2026-10-07', 'PM', NULL, '[]', '2026-10-08 00:30:27', NULL, 2, '2026-10-07 15:30:08', 1, 'Nouns and Verbs'),
(3, 'Activity — Nouns and Verbs', 'activity', 16, 1, 'A', 10, 'Q1', NULL, NULL, 0, NULL, 'AM', NULL, NULL, NULL, NULL, 2, '2026-10-07 15:30:19', 1, 'Nouns and Verbs'),
(4, 'Problem Solving', 'quiz', 12, 1, 'A', 10, 'Q1', NULL, '6c412ed489a16b6a', 1, '2026-10-08', 'AM', NULL, '[]', '2026-10-08 09:11:16', NULL, 2, '2026-10-08 00:11:09', 2, 'Problem Solving'),
(5, 'Activity — Nouns', 'activity', 16, 1, 'A', 5, 'Q1', NULL, NULL, 0, NULL, 'AM', NULL, NULL, NULL, NULL, 2, '2026-10-09 00:50:57', 6, 'Nouns'),
(6, 'Nouns', 'quiz', 16, 1, 'A', 10, 'Q1', NULL, 'b6711e7826711ab3', 1, '2026-10-09', 'AM', NULL, '[]', '2026-10-09 10:25:43', NULL, 2, '2026-10-09 01:24:55', 6, 'Nouns'),
(7, 'Quiz: Problem Solving', 'quiz', 12, 1, 'A', 10, 'Q1', NULL, '6218a1ba91db0ac6', 1, '2026-10-09', 'AM', NULL, '[]', '2026-10-09 10:30:05', NULL, 2, '2026-10-09 01:29:58', 2, 'Problem Solving'),
(9, 'Q1 Periodical Exam', 'exam', 16, 1, 'A', 34, 'Q1', NULL, 'c6e44cd227513b8e', 1, '2026-10-09', 'AM', NULL, '[]', '2026-10-09 10:37:07', NULL, 2, '2026-10-09 01:37:02', 6, 'Nouns');

-- --------------------------------------------------------

--
-- Table structure for table `assessment_questions`
--

CREATE TABLE `assessment_questions` (
  `id` int(11) NOT NULL,
  `assessment_id` int(11) NOT NULL,
  `question_bank_id` int(11) DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `item_type` varchar(32) NOT NULL DEFAULT 'mcq',
  `question` text NOT NULL,
  `choices` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`choices`)),
  `answer` varchar(500) DEFAULT NULL,
  `points` decimal(8,2) NOT NULL DEFAULT 1.00,
  `rubric` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`rubric`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `assessment_questions`
--

INSERT INTO `assessment_questions` (`id`, `assessment_id`, `question_bank_id`, `sort_order`, `item_type`, `question`, `choices`, `answer`, `points`, `rubric`, `created_at`) VALUES
(1, 1, 1, 0, 'mcq', 'What is a noun?', '[\"A person\",\"A place\",\"A thing\",\"An action\"]', '3', 1.00, NULL, '2026-10-06 02:50:13'),
(2, 1, 4, 1, 'mcq', 'What is the role of pronouns in sentences?', '[\"To replace nouns\",\"To add adjectives\",\"To modify verbs\",\"To describe adverbs\"]', '1', 1.00, NULL, '2026-10-06 02:50:13'),
(3, 1, 7, 2, 'mcq', 'What is the purpose of helping verbs?', '[\"To modify nouns\",\"To add adjectives\",\"To extend the meaning of verbs\",\"To describe adverbs\"]', '3', 1.00, NULL, '2026-10-06 02:50:13'),
(4, 1, 10, 3, 'mcq', 'What is the role of adverbs in sentences?', '[\"To replace nouns\",\"To add adjectives\",\"To modify verbs\",\"To describe adverbs\"]', '4', 1.00, NULL, '2026-10-06 02:50:13'),
(5, 1, 2, 4, 'identification', 'What is the name of the country where Anna visited?', NULL, 'France', 1.00, NULL, '2026-10-06 02:50:13'),
(6, 1, 5, 5, 'identification', 'What is the adjective that describes how Elsa looks?', NULL, 'Blonde', 1.00, NULL, '2026-10-06 02:50:13'),
(7, 1, 8, 6, 'identification', 'What is the name of the person who is singing in the first example?', NULL, 'Beyoncé', 1.00, NULL, '2026-10-06 02:50:13'),
(8, 1, 3, 7, 'enumeration', 'List two types of nouns that can be abstract.', NULL, 'Concepts,Feelings', 1.00, NULL, '2026-10-06 02:50:13'),
(9, 1, 6, 8, 'enumeration', 'List three types of verbs that can be used in a sentence.', NULL, 'Action verbs,Helping verbs,Adverbs', 1.00, NULL, '2026-10-06 02:50:13'),
(10, 1, 9, 9, 'enumeration', 'List two ways to modify verbs in a sentence.', NULL, 'With adverbs,With helping verbs', 1.00, NULL, '2026-10-06 02:50:13'),
(11, 2, 12, 0, 'mcq', 'What is the main idea of \"Nouns and Verbs\" for Grade 1 English?', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, NULL, '2026-10-07 15:30:08'),
(12, 2, 13, 1, 'mcq', 'Which statement best shows understanding of Nouns and Verbs?', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, NULL, '2026-10-07 15:30:08'),
(13, 2, 14, 2, 'mcq', 'Based on the objectives, students should practice Nouns and Verbs by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, NULL, '2026-10-07 15:30:08'),
(14, 2, 15, 3, 'mcq', 'Based on the objectives, students should practice Nouns and Verbs by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, NULL, '2026-10-07 15:30:08'),
(15, 2, 16, 4, 'identification', 'Identify one important term from the lesson \"Nouns and Verbs\".', NULL, 'Key term from Nouns and Verbs', 1.00, NULL, '2026-10-07 15:30:08'),
(16, 2, 17, 5, 'identification', 'Name the main skill practiced in \"Nouns and Verbs\" (English).', NULL, 'Skill from Nouns and Verbs', 1.00, NULL, '2026-10-07 15:30:08'),
(17, 2, 18, 6, 'identification', 'Name the main skill practiced in \"Nouns and Verbs\" (English).', NULL, 'Skill from Nouns and Verbs', 1.00, NULL, '2026-10-07 15:30:08'),
(18, 2, 19, 7, 'enumeration', 'List 2–3 things you learned about \"Nouns and Verbs\".', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, NULL, '2026-10-07 15:30:08'),
(19, 2, 20, 8, 'enumeration', 'Enumerate steps or examples related to \"Nouns and Verbs\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, NULL, '2026-10-07 15:30:08'),
(20, 2, 21, 9, 'enumeration', 'Enumerate steps or examples related to \"Nouns and Verbs\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, NULL, '2026-10-07 15:30:08'),
(21, 3, 22, 0, 'activity', 'Students work in pairs on a short Grade 1 task about \"Nouns and Verbs\" (English). They write or draw examples, share with a partner, then present one idea.', NULL, NULL, 10.00, '{\"categories\":[{\"name\":\"Participation\",\"max_points\":4,\"levels\":[{\"label\":\"Excellent\",\"points\":4,\"description\":\"Fully engaged; helps partner; stays on task.\"},{\"label\":\"Good\",\"points\":3,\"description\":\"Mostly engaged with little prompting.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Needs reminders to stay on task.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Rarely participates or off-task.\"}]},{\"name\":\"Correctness\",\"max_points\":3,\"levels\":[{\"label\":\"Excellent\",\"points\":3,\"description\":\"Ideas clearly match the lesson.\"},{\"label\":\"Good\",\"points\":2,\"description\":\"Mostly accurate with small gaps.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Partial understanding shown.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Little connection to the lesson.\"}]},{\"name\":\"Effort\",\"max_points\":3,\"levels\":[{\"label\":\"Excellent\",\"points\":3,\"description\":\"Complete, neat, thoughtful work.\"},{\"label\":\"Good\",\"points\":2,\"description\":\"Complete with adequate care.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Incomplete or rushed.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Minimal effort.\"}]}]}', '2026-10-07 15:30:19'),
(22, 4, 54, 0, 'mcq', 'What is the main idea of \"Problem Solving\" for Grade 1 Mathematics?', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, NULL, '2026-10-08 00:11:09'),
(23, 4, 55, 1, 'mcq', 'Which statement best shows understanding of Problem Solving?', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, NULL, '2026-10-08 00:11:09'),
(24, 4, 56, 2, 'mcq', 'Based on the objectives, students should practice Problem Solving by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, NULL, '2026-10-08 00:11:09'),
(25, 4, 57, 3, 'mcq', 'Based on the objectives, students should practice Problem Solving by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, NULL, '2026-10-08 00:11:09'),
(26, 4, 58, 4, 'identification', 'Identify one important term from the lesson \"Problem Solving\".', NULL, 'Key term from Problem Solving', 1.00, NULL, '2026-10-08 00:11:09'),
(27, 4, 59, 5, 'identification', 'Name the main skill practiced in \"Problem Solving\" (Mathematics).', NULL, 'Skill from Problem Solving', 1.00, NULL, '2026-10-08 00:11:09'),
(28, 4, 60, 6, 'identification', 'Name the main skill practiced in \"Problem Solving\" (Mathematics).', NULL, 'Skill from Problem Solving', 1.00, NULL, '2026-10-08 00:11:09'),
(29, 4, 61, 7, 'enumeration', 'List 2–3 things you learned about \"Problem Solving\".', NULL, 'Possible answers: concepts or steps from the lesson objectives', 1.00, NULL, '2026-10-08 00:11:09'),
(30, 4, 62, 8, 'enumeration', 'Enumerate steps or examples related to \"Problem Solving\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 1.00, NULL, '2026-10-08 00:11:09'),
(31, 4, 63, 9, 'enumeration', 'Enumerate steps or examples related to \"Problem Solving\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 1.00, NULL, '2026-10-08 00:11:09'),
(32, 5, 156, 0, 'activity', 'Sort the following nouns into categories: tangible, abstract, singular, or plural. Use the vocabulary and sentence structures learned in class.', NULL, NULL, 5.00, '{\"categories\":[{\"name\":\"Accuracy\",\"max_points\":5,\"levels\":[{\"label\":\"Excellent\",\"points\":5,\"description\":\"All nouns are correctly sorted into categories.\"},{\"label\":\"Good\",\"points\":3,\"description\":\"Most nouns are correctly sorted, but some may be incorrect.\"},{\"label\":\"Fair\",\"points\":1,\"description\":\"Some nouns are correctly sorted, but many are incorrect.\"},{\"label\":\"Needs Improvement\",\"points\":2,\"description\":\"Most nouns are incorrectly sorted.\"}]}]}', '2026-10-09 00:50:57'),
(33, 6, 146, 0, 'mcq', 'What is a noun?', '[\"A person\",\"A place\",\"A thing\",\"A verb\"]', '3', 1.00, NULL, '2026-10-09 01:24:55'),
(34, 6, 149, 1, 'mcq', 'Is \'she\' a subject pronoun or an object pronoun in the sentence \'She is a princess\'?', '[\"Subject pronoun\",\"Object pronoun\",\"Both\",\"Neither\"]', '1', 1.00, NULL, '2026-10-09 01:24:55'),
(35, 6, 152, 2, 'mcq', 'Is \'he\' a subject pronoun or an object pronoun in the sentence \'He is a boy\'?', '[\"Subject pronoun\",\"Object pronoun\",\"Both\",\"Neither\"]', '1', 1.00, NULL, '2026-10-09 01:24:55'),
(36, 6, 155, 3, 'mcq', 'Is \'she\' a subject pronoun or an object pronoun in the sentence \'She is a princess\'?', '[\"Subject pronoun\",\"Object pronoun\",\"Both\",\"Neither\"]', '1', 1.00, NULL, '2026-10-09 01:24:55'),
(37, 6, 147, 4, 'identification', 'What is the noun in the sentence \'The girl is reading a book\'?', NULL, 'girl', 1.00, NULL, '2026-10-09 01:24:55'),
(38, 6, 150, 5, 'identification', 'What is the adjective in the sentence \'Elsa is blonde\'?', NULL, 'blonde', 1.00, NULL, '2026-10-09 01:24:55'),
(39, 6, 153, 6, 'identification', 'What is the verb in the sentence \'Batman drives the Batmobile\'?', NULL, 'drives', 1.00, NULL, '2026-10-09 01:24:55'),
(40, 6, 148, 7, 'enumeration', 'List 3 types of nouns (tangible or abstract).', NULL, '1. Dog, 2. Happiness, 3. France', 1.00, NULL, '2026-10-09 01:24:55'),
(41, 6, 151, 8, 'enumeration', 'List 2 types of adjectives.', NULL, '1. Descriptive, 2. Quantitative', 1.00, NULL, '2026-10-09 01:24:55'),
(42, 6, 154, 9, 'enumeration', 'List 3 types of verb tenses.', NULL, '1. Past tense, 2. Present tense, 3. Future tense', 1.00, NULL, '2026-10-09 01:24:55'),
(43, 7, 54, 0, 'mcq', 'What is the main idea of \"Problem Solving\" for Grade 1 Mathematics?', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, NULL, '2026-10-09 01:29:58'),
(44, 7, 55, 1, 'mcq', 'Which statement best shows understanding of Problem Solving?', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, NULL, '2026-10-09 01:29:58'),
(45, 7, 56, 2, 'mcq', 'Based on the objectives, students should practice Problem Solving by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, NULL, '2026-10-09 01:29:58'),
(46, 7, 57, 3, 'mcq', 'Based on the objectives, students should practice Problem Solving by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, NULL, '2026-10-09 01:29:58'),
(47, 7, 58, 4, 'identification', 'Identify one important term from the lesson \"Problem Solving\".', NULL, 'Key term from Problem Solving', 1.00, NULL, '2026-10-09 01:29:58'),
(48, 7, 59, 5, 'identification', 'Name the main skill practiced in \"Problem Solving\" (Mathematics).', NULL, 'Skill from Problem Solving', 1.00, NULL, '2026-10-09 01:29:59'),
(49, 7, 60, 6, 'identification', 'Name the main skill practiced in \"Problem Solving\" (Mathematics).', NULL, 'Skill from Problem Solving', 1.00, NULL, '2026-10-09 01:29:59'),
(50, 7, 61, 7, 'enumeration', 'List 2–3 things you learned about \"Problem Solving\".', NULL, 'Possible answers: concepts or steps from the lesson objectives', 1.00, NULL, '2026-10-09 01:29:59'),
(51, 7, 62, 8, 'enumeration', 'Enumerate steps or examples related to \"Problem Solving\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 1.00, NULL, '2026-10-09 01:29:59'),
(52, 7, 63, 9, 'enumeration', 'Enumerate steps or examples related to \"Problem Solving\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 1.00, NULL, '2026-10-09 01:29:59'),
(53, 8, 146, 0, 'mcq', 'What is a noun?', '[\"A person\",\"A place\",\"A thing\",\"A verb\"]', '3', 1.00, NULL, '2026-10-09 01:36:32'),
(54, 8, 149, 1, 'mcq', 'Is \'she\' a subject pronoun or an object pronoun in the sentence \'She is a princess\'?', '[\"Subject pronoun\",\"Object pronoun\",\"Both\",\"Neither\"]', '1', 1.00, NULL, '2026-10-09 01:36:32'),
(55, 8, 152, 2, 'mcq', 'Is \'he\' a subject pronoun or an object pronoun in the sentence \'He is a boy\'?', '[\"Subject pronoun\",\"Object pronoun\",\"Both\",\"Neither\"]', '1', 1.00, NULL, '2026-10-09 01:36:32'),
(56, 8, 155, 3, 'mcq', 'Is \'she\' a subject pronoun or an object pronoun in the sentence \'She is a princess\'?', '[\"Subject pronoun\",\"Object pronoun\",\"Both\",\"Neither\"]', '1', 1.00, NULL, '2026-10-09 01:36:32'),
(57, 8, 147, 4, 'identification', 'What is the noun in the sentence \'The girl is reading a book\'?', NULL, 'girl', 1.00, NULL, '2026-10-09 01:36:32'),
(58, 8, 150, 5, 'identification', 'What is the adjective in the sentence \'Elsa is blonde\'?', NULL, 'blonde', 1.00, NULL, '2026-10-09 01:36:32'),
(59, 8, 153, 6, 'identification', 'What is the verb in the sentence \'Batman drives the Batmobile\'?', NULL, 'drives', 1.00, NULL, '2026-10-09 01:36:32'),
(60, 8, 148, 7, 'enumeration', 'List 3 types of nouns (tangible or abstract).', NULL, '1. Dog, 2. Happiness, 3. France', 2.00, NULL, '2026-10-09 01:36:32'),
(61, 8, 151, 8, 'enumeration', 'List 2 types of adjectives.', NULL, '1. Descriptive, 2. Quantitative', 2.00, NULL, '2026-10-09 01:36:32'),
(62, 8, 154, 9, 'enumeration', 'List 3 types of verb tenses.', NULL, '1. Past tense, 2. Present tense, 3. Future tense', 2.00, NULL, '2026-10-09 01:36:32'),
(63, 8, 156, 10, 'activity', 'Sort the following nouns into categories: tangible, abstract, singular, or plural. Use the vocabulary and sentence structures learned in class.', NULL, NULL, 5.00, '{\"categories\":[{\"name\":\"Accuracy\",\"max_points\":5,\"levels\":[{\"label\":\"Excellent\",\"points\":5,\"description\":\"All nouns are correctly sorted into categories.\"},{\"label\":\"Good\",\"points\":3,\"description\":\"Most nouns are correctly sorted, but some may be incorrect.\"},{\"label\":\"Fair\",\"points\":1,\"description\":\"Some nouns are correctly sorted, but many are incorrect.\"},{\"label\":\"Needs Improvement\",\"points\":2,\"description\":\"Most nouns are incorrectly sorted.\"}]}]}', '2026-10-09 01:36:32'),
(64, 8, 138, 11, 'mcq', 'What are people, places, or things called?', '[\"Things\",\"People\",\"Nouns\"]', 'Nouns', 1.00, NULL, '2026-10-09 01:36:32'),
(65, 8, 139, 12, 'mcq', 'What do pronouns replace in a sentence?', '[\"Object\",\"Subject\",\"Noun\"]', 'Subject', 1.00, NULL, '2026-10-09 01:36:32'),
(66, 8, 140, 13, 'mcq', 'What do adverbs modify?', '[\"Verbs\",\"Adjectives\",\"Nouns\"]', 'Verbs', 1.00, NULL, '2026-10-09 01:36:32'),
(67, 8, 141, 14, 'mcq', 'What are action words called?', '[\"Verbs\",\"Adjectives\",\"Nouns\"]', 'Verbs', 1.00, NULL, '2026-10-09 01:36:32'),
(68, 8, 142, 15, 'mcq', 'What do adverbs help with?', '[\"Verb usage\",\"Sentence structure\",\"Verb meaning\"]', 'Verb usage', 1.00, NULL, '2026-10-09 01:36:32'),
(69, 8, 143, 16, 'mcq', 'What do verbs can be in?', '[\"Tenses\",\"Parts of speech\",\"Sentences\"]', 'Tenses', 1.00, NULL, '2026-10-09 01:36:32'),
(70, 8, 144, 17, 'mcq', 'What introduces adjectives?', '[\"A helping verb\",\"A noun\",\"A verb\"]', 'A helping verb', 1.00, NULL, '2026-10-09 01:36:32'),
(71, 8, 145, 18, 'mcq', 'What are adjectives?', '[\"Descriptive words\",\"A type of noun\",\"A type of verb\"]', 'Descriptive words', 1.00, NULL, '2026-10-09 01:36:32'),
(72, 8, 54, 19, 'mcq', 'What is the main idea of \"Problem Solving\" for Grade 1 Mathematics?', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, NULL, '2026-10-09 01:36:32'),
(73, 8, 55, 20, 'mcq', 'Which statement best shows understanding of Problem Solving?', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, NULL, '2026-10-09 01:36:32'),
(74, 8, 56, 21, 'mcq', 'Based on the objectives, students should practice Problem Solving by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, NULL, '2026-10-09 01:36:32'),
(75, 8, 57, 22, 'mcq', 'Based on the objectives, students should practice Problem Solving by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, NULL, '2026-10-09 01:36:32'),
(76, 8, 58, 23, 'identification', 'Identify one important term from the lesson \"Problem Solving\".', NULL, 'Key term from Problem Solving', 1.00, NULL, '2026-10-09 01:36:32'),
(77, 8, 59, 24, 'identification', 'Name the main skill practiced in \"Problem Solving\" (Mathematics).', NULL, 'Skill from Problem Solving', 1.00, NULL, '2026-10-09 01:36:32'),
(78, 8, 60, 25, 'identification', 'Name the main skill practiced in \"Problem Solving\" (Mathematics).', NULL, 'Skill from Problem Solving', 1.00, NULL, '2026-10-09 01:36:32'),
(79, 8, 61, 26, 'enumeration', 'List 2–3 things you learned about \"Problem Solving\".', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, NULL, '2026-10-09 01:36:32'),
(80, 8, 62, 27, 'enumeration', 'Enumerate steps or examples related to \"Problem Solving\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, NULL, '2026-10-09 01:36:32'),
(81, 8, 63, 28, 'enumeration', 'Enumerate steps or examples related to \"Problem Solving\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, NULL, '2026-10-09 01:36:32'),
(82, 8, 64, 29, 'activity', 'Students work in pairs on a short Grade 1 task about \"Problem Solving\" (Mathematics). They write or draw examples, share with a partner, then present one idea.', NULL, NULL, 10.00, '{\"categories\":[{\"name\":\"Participation\",\"max_points\":4,\"levels\":[{\"label\":\"Excellent\",\"points\":4,\"description\":\"Fully engaged; helps partner; stays on task.\"},{\"label\":\"Good\",\"points\":3,\"description\":\"Mostly engaged with little prompting.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Needs reminders to stay on task.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Rarely participates or off-task.\"}]},{\"name\":\"Correctness\",\"max_points\":3,\"levels\":[{\"label\":\"Excellent\",\"points\":3,\"description\":\"Ideas clearly match the lesson.\"},{\"label\":\"Good\",\"points\":2,\"description\":\"Mostly accurate with small gaps.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Partial understanding shown.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Little connection to the lesson.\"}]},{\"name\":\"Effort\",\"max_points\":3,\"levels\":[{\"label\":\"Excellent\",\"points\":3,\"description\":\"Complete, neat, thoughtful work.\"},{\"label\":\"Good\",\"points\":2,\"description\":\"Complete with adequate care.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Incomplete or rushed.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Minimal effort.\"}]}]}', '2026-10-09 01:36:32'),
(83, 9, 146, 0, 'mcq', 'What is a noun?', '[\"A person\",\"A place\",\"A thing\",\"A verb\"]', '3', 1.00, NULL, '2026-10-09 01:37:02'),
(84, 9, 149, 1, 'mcq', 'Is \'she\' a subject pronoun or an object pronoun in the sentence \'She is a princess\'?', '[\"Subject pronoun\",\"Object pronoun\",\"Both\",\"Neither\"]', '1', 1.00, NULL, '2026-10-09 01:37:02'),
(85, 9, 152, 2, 'mcq', 'Is \'he\' a subject pronoun or an object pronoun in the sentence \'He is a boy\'?', '[\"Subject pronoun\",\"Object pronoun\",\"Both\",\"Neither\"]', '1', 1.00, NULL, '2026-10-09 01:37:02'),
(86, 9, 155, 3, 'mcq', 'Is \'she\' a subject pronoun or an object pronoun in the sentence \'She is a princess\'?', '[\"Subject pronoun\",\"Object pronoun\",\"Both\",\"Neither\"]', '1', 1.00, NULL, '2026-10-09 01:37:02'),
(87, 9, 147, 4, 'identification', 'What is the noun in the sentence \'The girl is reading a book\'?', NULL, 'girl', 1.00, NULL, '2026-10-09 01:37:02'),
(88, 9, 150, 5, 'identification', 'What is the adjective in the sentence \'Elsa is blonde\'?', NULL, 'blonde', 1.00, NULL, '2026-10-09 01:37:02'),
(89, 9, 153, 6, 'identification', 'What is the verb in the sentence \'Batman drives the Batmobile\'?', NULL, 'drives', 1.00, NULL, '2026-10-09 01:37:02'),
(90, 9, 148, 7, 'enumeration', 'List 3 types of nouns (tangible or abstract).', NULL, '1. Dog, 2. Happiness, 3. France', 2.00, NULL, '2026-10-09 01:37:02'),
(91, 9, 151, 8, 'enumeration', 'List 2 types of adjectives.', NULL, '1. Descriptive, 2. Quantitative', 2.00, NULL, '2026-10-09 01:37:02'),
(92, 9, 154, 9, 'enumeration', 'List 3 types of verb tenses.', NULL, '1. Past tense, 2. Present tense, 3. Future tense', 2.00, NULL, '2026-10-09 01:37:02'),
(93, 9, 138, 10, 'mcq', 'What are people, places, or things called?', '[\"Things\",\"People\",\"Nouns\"]', 'Nouns', 1.00, NULL, '2026-10-09 01:37:02'),
(94, 9, 139, 11, 'mcq', 'What do pronouns replace in a sentence?', '[\"Object\",\"Subject\",\"Noun\"]', 'Subject', 1.00, NULL, '2026-10-09 01:37:02'),
(95, 9, 140, 12, 'mcq', 'What do adverbs modify?', '[\"Verbs\",\"Adjectives\",\"Nouns\"]', 'Verbs', 1.00, NULL, '2026-10-09 01:37:02'),
(96, 9, 141, 13, 'mcq', 'What are action words called?', '[\"Verbs\",\"Adjectives\",\"Nouns\"]', 'Verbs', 1.00, NULL, '2026-10-09 01:37:02'),
(97, 9, 142, 14, 'mcq', 'What do adverbs help with?', '[\"Verb usage\",\"Sentence structure\",\"Verb meaning\"]', 'Verb usage', 1.00, NULL, '2026-10-09 01:37:02'),
(98, 9, 143, 15, 'mcq', 'What do verbs can be in?', '[\"Tenses\",\"Parts of speech\",\"Sentences\"]', 'Tenses', 1.00, NULL, '2026-10-09 01:37:02'),
(99, 9, 144, 16, 'mcq', 'What introduces adjectives?', '[\"A helping verb\",\"A noun\",\"A verb\"]', 'A helping verb', 1.00, NULL, '2026-10-09 01:37:02'),
(100, 9, 145, 17, 'mcq', 'What are adjectives?', '[\"Descriptive words\",\"A type of noun\",\"A type of verb\"]', 'Descriptive words', 1.00, NULL, '2026-10-09 01:37:02'),
(101, 9, 54, 18, 'mcq', 'What is the main idea of \"Problem Solving\" for Grade 1 Mathematics?', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, NULL, '2026-10-09 01:37:02'),
(102, 9, 55, 19, 'mcq', 'Which statement best shows understanding of Problem Solving?', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, NULL, '2026-10-09 01:37:02'),
(103, 9, 56, 20, 'mcq', 'Based on the objectives, students should practice Problem Solving by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, NULL, '2026-10-09 01:37:02'),
(104, 9, 57, 21, 'mcq', 'Based on the objectives, students should practice Problem Solving by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, NULL, '2026-10-09 01:37:02'),
(105, 9, 58, 22, 'identification', 'Identify one important term from the lesson \"Problem Solving\".', NULL, 'Key term from Problem Solving', 1.00, NULL, '2026-10-09 01:37:02'),
(106, 9, 59, 23, 'identification', 'Name the main skill practiced in \"Problem Solving\" (Mathematics).', NULL, 'Skill from Problem Solving', 1.00, NULL, '2026-10-09 01:37:02'),
(107, 9, 60, 24, 'identification', 'Name the main skill practiced in \"Problem Solving\" (Mathematics).', NULL, 'Skill from Problem Solving', 1.00, NULL, '2026-10-09 01:37:02'),
(108, 9, 61, 25, 'enumeration', 'List 2–3 things you learned about \"Problem Solving\".', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, NULL, '2026-10-09 01:37:02'),
(109, 9, 62, 26, 'enumeration', 'Enumerate steps or examples related to \"Problem Solving\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, NULL, '2026-10-09 01:37:02'),
(110, 9, 63, 27, 'enumeration', 'Enumerate steps or examples related to \"Problem Solving\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, NULL, '2026-10-09 01:37:02');

-- --------------------------------------------------------

--
-- Table structure for table `assessment_scores`
--

CREATE TABLE `assessment_scores` (
  `id` int(11) NOT NULL,
  `assessment_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `score` decimal(8,2) NOT NULL,
  `rubric_scores` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`rubric_scores`)),
  `recorded_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `assessment_scores`
--

INSERT INTO `assessment_scores` (`id`, `assessment_id`, `student_id`, `score`, `rubric_scores`, `recorded_at`) VALUES
(1, 1, 5, 3.00, NULL, '2026-10-06 02:51:49'),
(2, 2, 5, 1.00, NULL, '2026-10-07 15:31:05'),
(3, 4, 5, 9.00, NULL, '2026-10-08 00:13:31'),
(4, 6, 5, 1.00, NULL, '2026-10-09 01:26:19'),
(5, 7, 5, 4.00, NULL, '2026-10-09 01:30:32'),
(6, 5, 5, 4.00, '{\"a0_0\":4,\"Accuracy\":4}', '2026-10-09 01:31:31'),
(7, 9, 5, 3.00, NULL, '2026-10-09 01:38:08');

-- --------------------------------------------------------

--
-- Table structure for table `attendance`
--

CREATE TABLE `attendance` (
  `id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `DATE` date NOT NULL,
  `session` enum('AM','PM') NOT NULL DEFAULT 'AM',
  `subject_id` int(11) DEFAULT NULL,
  `subject_key` int(11) GENERATED ALWAYS AS (ifnull(`subject_id`,0)) STORED,
  `STATUS` enum('Present','Absent','Late','Excused') NOT NULL,
  `recorded_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `attendance`
--

INSERT INTO `attendance` (`id`, `student_id`, `DATE`, `session`, `subject_id`, `STATUS`, `recorded_by`, `created_at`) VALUES
(1, 5, '2026-10-06', 'AM', NULL, 'Present', 2, '2026-10-06 02:50:23'),
(2, 5, '2026-10-07', 'PM', NULL, 'Present', 2, '2026-10-07 15:18:25'),
(3, 5, '2026-10-07', 'AM', NULL, 'Present', 2, '2026-10-07 15:22:15'),
(4, 5, '2026-10-08', 'AM', NULL, 'Present', 2, '2026-10-07 23:58:17'),
(6, 8, '2026-10-08', 'AM', NULL, 'Present', 2, '2026-10-08 14:31:40'),
(8, 5, '2026-10-08', 'PM', NULL, 'Late', 2, '2026-10-08 14:31:49'),
(9, 8, '2026-10-08', 'PM', NULL, 'Present', 2, '2026-10-08 14:34:58'),
(10, 7, '2026-10-08', 'PM', NULL, 'Present', 2, '2026-10-08 14:35:00'),
(20, 7, '2026-10-08', 'AM', NULL, 'Present', 2, '2026-10-08 14:42:29'),
(21, 5, '2026-10-09', 'AM', NULL, 'Present', 2, '2026-10-09 00:33:54'),
(22, 8, '2026-10-09', 'AM', NULL, 'Present', 2, '2026-10-09 01:25:34'),
(23, 7, '2026-10-09', 'AM', NULL, 'Present', 2, '2026-10-09 01:25:35');

-- --------------------------------------------------------

--
-- Table structure for table `concerns`
--

CREATE TABLE `concerns` (
  `id` int(11) NOT NULL,
  `parent_id` int(11) NOT NULL,
  `teacher_id` int(11) DEFAULT NULL,
  `student_id` int(11) DEFAULT NULL,
  `SUBJECT` varchar(255) DEFAULT NULL,
  `message` text NOT NULL,
  `STATUS` enum('open','resolved','closed') DEFAULT 'open',
  `priority` enum('low','normal','high','urgent') DEFAULT 'normal',
  `teacher_reply` text DEFAULT NULL,
  `replied_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `concern_reads`
--

CREATE TABLE `concern_reads` (
  `user_id` int(11) NOT NULL,
  `concern_id` int(11) NOT NULL,
  `read_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `concern_replies`
--

CREATE TABLE `concern_replies` (
  `id` int(11) NOT NULL,
  `concern_id` int(11) NOT NULL,
  `sender_id` int(11) NOT NULL,
  `message` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `lesson_plans`
--

CREATE TABLE `lesson_plans` (
  `id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `subject_id` int(11) DEFAULT NULL,
  `grade_level` int(11) NOT NULL,
  `objectives` text DEFAULT NULL,
  `file_path` varchar(500) DEFAULT NULL,
  `uploaded_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `lesson_plans`
--

INSERT INTO `lesson_plans` (`id`, `title`, `subject_id`, `grade_level`, `objectives`, `file_path`, `uploaded_by`, `created_at`) VALUES
(2, 'Problem Solving', 12, 1, NULL, '/assets/lesson-plans/lp_2_1791418064080.pdf', 2, '2026-10-08 00:07:44'),
(3, 'Sample', 13, 1, NULL, '/assets/lesson-plans/lp_2_1791418115043.pdf', 2, '2026-10-08 00:08:35'),
(6, 'Nouns', 16, 1, NULL, '/assets/lesson-plans/lp_2_1791437312440.pdf', 2, '2026-10-08 05:28:32');

-- --------------------------------------------------------

--
-- Table structure for table `messages`
--

CREATE TABLE `messages` (
  `id` int(11) NOT NULL,
  `sender_id` int(11) NOT NULL,
  `receiver_id` int(11) DEFAULT NULL,
  `student_id` int(11) DEFAULT NULL,
  `SUBJECT` varchar(255) DEFAULT NULL,
  `message` text NOT NULL,
  `category` enum('concern','announcement','general') DEFAULT 'general',
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `messages`
--

INSERT INTO `messages` (`id`, `sender_id`, `receiver_id`, `student_id`, `SUBJECT`, `message`, `category`, `is_read`, `created_at`) VALUES
(1, 2, 3, 5, 'Attendance update for Cams Lasr', 'Cams Lasr was marked Present (PM session) in Grade 1-A on 2026-10-08.', 'announcement', 1, '2026-10-08 14:32:18'),
(2, 2, 3, 5, 'Attendance update for Cams Lasr', 'Cams Lasr was marked Absent (PM session) in Grade 1-A on 2026-10-08.', 'announcement', 1, '2026-10-08 14:35:11'),
(3, 2, 11, 8, 'Attendance update for Ben Reyes', 'Ben Reyes was marked Present (PM session) in Grade 1-A on 2026-10-08.', 'announcement', 0, '2026-10-08 14:35:11'),
(4, 2, 11, 7, 'Attendance update for Ana Santos', 'Ana Santos was marked Present (PM session) in Grade 1-A on 2026-10-08.', 'announcement', 0, '2026-10-08 14:35:11'),
(5, 2, 3, 5, 'Attendance update for Cams Lasr', 'Cams Lasr was marked Absent (AM session) in Grade 1-A on 2026-10-08.', 'announcement', 1, '2026-10-08 14:36:58'),
(6, 2, 11, 8, 'Attendance update for Ben Reyes', 'Ben Reyes was marked Present (AM session) in Grade 1-A on 2026-10-08.', 'announcement', 0, '2026-10-08 14:36:58'),
(7, 2, 3, 5, 'Attendance update for Cams Lasr', 'Cams Lasr was marked Late (PM session) in Grade 1-A on 2026-10-08.', 'announcement', 1, '2026-10-08 14:38:53'),
(8, 2, 3, 5, 'Attendance update for Cams Lasr', 'Cams Lasr was marked Present (AM session) in Grade 1-A on 2026-10-08.', 'announcement', 1, '2026-10-08 14:42:35'),
(9, 2, 11, 7, 'Attendance update for Ana Santos', 'Ana Santos was marked Present (AM session) in Grade 1-A on 2026-10-08.', 'announcement', 0, '2026-10-08 14:42:35'),
(10, 2, 3, 5, 'Attendance update for Cams Lasr', 'Cams Lasr was marked Present (AM session) in Grade 1-A on 2026-10-09.', 'announcement', 1, '2026-10-09 00:34:18'),
(11, 2, 3, 5, 'Attendance update for Cams Lasr', 'Cams Lasr was marked Absent (AM session) in Grade 1-A on 2026-10-09.', 'announcement', 0, '2026-10-09 01:27:20');

-- --------------------------------------------------------

--
-- Table structure for table `parent_profiles`
--

CREATE TABLE `parent_profiles` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `address` text DEFAULT NULL,
  `emergency_contact` varchar(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `parent_profiles`
--

INSERT INTO `parent_profiles` (`id`, `user_id`, `address`, `emergency_contact`) VALUES
(1, 3, 'San Vicente Ogbon, Nabua, Camarines Sur', '09708668466'),
(3, 11, 'Iriga City', '09181234567'),
(4, 12, 'Naga City', '09181234568'),
(5, 13, 'Pili', '09181234569'),
(7, 22, NULL, NULL),
(8, 23, NULL, NULL),
(9, 24, NULL, NULL),
(10, 25, NULL, NULL),
(11, 26, NULL, NULL),
(12, 27, NULL, NULL),
(13, 28, 'Nabua', '09222555100'),
(14, 29, 'Iriga', '09489321252');

-- --------------------------------------------------------

--
-- Table structure for table `parent_student_links`
--

CREATE TABLE `parent_student_links` (
  `id` int(11) NOT NULL,
  `parent_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `parent_student_links`
--

INSERT INTO `parent_student_links` (`id`, `parent_id`, `student_id`, `created_at`) VALUES
(5, 3, 5, '2026-08-17 05:12:58'),
(7, 11, 7, '2026-10-08 07:29:18'),
(8, 11, 8, '2026-10-08 07:29:18'),
(9, 12, 9, '2026-10-08 07:29:18'),
(10, 12, 10, '2026-10-08 07:29:18'),
(11, 13, 11, '2026-10-08 07:29:18');

-- --------------------------------------------------------

--
-- Table structure for table `question_bank`
--

CREATE TABLE `question_bank` (
  `id` int(11) NOT NULL,
  `teacher_id` int(11) NOT NULL,
  `quiz_set_id` int(11) DEFAULT NULL,
  `subject_id` int(11) DEFAULT NULL,
  `grade_level` int(11) NOT NULL,
  `lesson_plan_id` int(11) DEFAULT NULL,
  `lesson_title` varchar(255) DEFAULT NULL,
  `item_type` varchar(32) NOT NULL DEFAULT 'mcq',
  `question` text NOT NULL,
  `choices` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`choices`)),
  `answer` varchar(500) DEFAULT NULL,
  `points` decimal(8,2) NOT NULL DEFAULT 1.00,
  `source` enum('ai','manual') NOT NULL DEFAULT 'manual',
  `ai_recommendation_id` int(11) DEFAULT NULL,
  `status` enum('active','archived') NOT NULL DEFAULT 'active',
  `rubric` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`rubric`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `question_bank`
--

INSERT INTO `question_bank` (`id`, `teacher_id`, `quiz_set_id`, `subject_id`, `grade_level`, `lesson_plan_id`, `lesson_title`, `item_type`, `question`, `choices`, `answer`, `points`, `source`, `ai_recommendation_id`, `status`, `rubric`, `created_at`, `updated_at`) VALUES
(1, 2, 1, 16, 1, 1, 'Nouns and Verbs', 'mcq', 'What is a noun?', '[\"A person\",\"A place\",\"A thing\",\"An action\"]', '3', 1.00, 'ai', 1, 'archived', NULL, '2026-10-06 02:49:13', '2026-10-08 05:50:28'),
(2, 2, 1, 16, 1, 1, 'Nouns and Verbs', 'identification', 'What is the name of the country where Anna visited?', NULL, 'France', 1.00, 'ai', 1, 'archived', NULL, '2026-10-06 02:49:13', '2026-10-08 05:50:28'),
(3, 2, 1, 16, 1, 1, 'Nouns and Verbs', 'enumeration', 'List two types of nouns that can be abstract.', NULL, 'Concepts,Feelings', 2.00, 'ai', 1, 'archived', NULL, '2026-10-06 02:49:13', '2026-10-08 05:50:28'),
(4, 2, 1, 16, 1, 1, 'Nouns and Verbs', 'mcq', 'What is the role of pronouns in sentences?', '[\"To replace nouns\",\"To add adjectives\",\"To modify verbs\",\"To describe adverbs\"]', '1', 1.00, 'ai', 1, 'archived', NULL, '2026-10-06 02:49:13', '2026-10-08 05:50:28'),
(5, 2, 1, 16, 1, 1, 'Nouns and Verbs', 'identification', 'What is the adjective that describes how Elsa looks?', NULL, 'Blonde', 1.00, 'ai', 1, 'archived', NULL, '2026-10-06 02:49:13', '2026-10-08 05:50:28'),
(6, 2, 1, 16, 1, 1, 'Nouns and Verbs', 'enumeration', 'List three types of verbs that can be used in a sentence.', NULL, 'Action verbs,Helping verbs,Adverbs', 2.00, 'ai', 1, 'archived', NULL, '2026-10-06 02:49:13', '2026-10-08 05:50:28'),
(7, 2, 1, 16, 1, 1, 'Nouns and Verbs', 'mcq', 'What is the purpose of helping verbs?', '[\"To modify nouns\",\"To add adjectives\",\"To extend the meaning of verbs\",\"To describe adverbs\"]', '3', 1.00, 'ai', 1, 'archived', NULL, '2026-10-06 02:49:13', '2026-10-08 05:50:28'),
(8, 2, 1, 16, 1, 1, 'Nouns and Verbs', 'identification', 'What is the name of the person who is singing in the first example?', NULL, 'Beyoncé', 1.00, 'ai', 1, 'archived', NULL, '2026-10-06 02:49:13', '2026-10-08 05:50:28'),
(9, 2, 1, 16, 1, 1, 'Nouns and Verbs', 'enumeration', 'List two ways to modify verbs in a sentence.', NULL, 'With adverbs,With helping verbs', 2.00, 'ai', 1, 'archived', NULL, '2026-10-06 02:49:13', '2026-10-08 05:50:28'),
(10, 2, 1, 16, 1, 1, 'Nouns and Verbs', 'mcq', 'What is the role of adverbs in sentences?', '[\"To replace nouns\",\"To add adjectives\",\"To modify verbs\",\"To describe adverbs\"]', '4', 1.00, 'ai', 1, 'archived', NULL, '2026-10-06 02:49:13', '2026-10-08 05:50:28'),
(11, 2, 1, 16, 1, 1, 'Nouns and Verbs', 'activity', 'Sort the following words into their correct categories: nouns, verbs, adjectives, and pronouns. Use the definitions provided to help you make your decisions.', NULL, NULL, 5.00, 'ai', 1, 'archived', '{\"categories\":[{\"name\":\"Participation\",\"max_points\":2,\"levels\":[{\"label\":\"Excellent\",\"points\":2,\"description\":\"All words are correctly sorted into their categories.\"},{\"label\":\"Good\",\"points\":1,\"description\":\"Most words are correctly sorted, but some may be incorrect.\"},{\"label\":\"Fair\",\"points\":1,\"description\":\"Some words are correctly sorted, but many are incorrect.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Most words are incorrectly sorted.\"}]}]}', '2026-10-06 02:49:13', '2026-10-08 05:50:28'),
(12, 2, 2, 16, 1, 1, 'Nouns and Verbs', 'mcq', 'What is the main idea of \"Nouns and Verbs\" for Grade 1 English?', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 2, 'archived', NULL, '2026-10-07 15:29:36', '2026-10-08 05:50:36'),
(13, 2, 2, 16, 1, 1, 'Nouns and Verbs', 'mcq', 'Which statement best shows understanding of Nouns and Verbs?', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 2, 'archived', NULL, '2026-10-07 15:29:36', '2026-10-08 05:50:36'),
(14, 2, 2, 16, 1, 1, 'Nouns and Verbs', 'mcq', 'Based on the objectives, students should practice Nouns and Verbs by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 2, 'archived', NULL, '2026-10-07 15:29:36', '2026-10-08 05:50:36'),
(15, 2, 2, 16, 1, 1, 'Nouns and Verbs', 'mcq', 'Based on the objectives, students should practice Nouns and Verbs by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 2, 'archived', NULL, '2026-10-07 15:29:36', '2026-10-08 05:50:36'),
(16, 2, 2, 16, 1, 1, 'Nouns and Verbs', 'identification', 'Identify one important term from the lesson \"Nouns and Verbs\".', NULL, 'Key term from Nouns and Verbs', 1.00, 'ai', 2, 'archived', NULL, '2026-10-07 15:29:36', '2026-10-08 05:50:36'),
(17, 2, 2, 16, 1, 1, 'Nouns and Verbs', 'identification', 'Name the main skill practiced in \"Nouns and Verbs\" (English).', NULL, 'Skill from Nouns and Verbs', 1.00, 'ai', 2, 'archived', NULL, '2026-10-07 15:29:36', '2026-10-08 05:50:36'),
(18, 2, 2, 16, 1, 1, 'Nouns and Verbs', 'identification', 'Name the main skill practiced in \"Nouns and Verbs\" (English).', NULL, 'Skill from Nouns and Verbs', 1.00, 'ai', 2, 'archived', NULL, '2026-10-07 15:29:36', '2026-10-08 05:50:36'),
(19, 2, 2, 16, 1, 1, 'Nouns and Verbs', 'enumeration', 'List 2–3 things you learned about \"Nouns and Verbs\".', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 2, 'archived', NULL, '2026-10-07 15:29:36', '2026-10-08 05:50:36'),
(20, 2, 2, 16, 1, 1, 'Nouns and Verbs', 'enumeration', 'Enumerate steps or examples related to \"Nouns and Verbs\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 2, 'archived', NULL, '2026-10-07 15:29:36', '2026-10-08 05:50:36'),
(21, 2, 2, 16, 1, 1, 'Nouns and Verbs', 'enumeration', 'Enumerate steps or examples related to \"Nouns and Verbs\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 2, 'archived', NULL, '2026-10-07 15:29:36', '2026-10-08 05:50:36'),
(22, 2, 2, 16, 1, 1, 'Nouns and Verbs', 'activity', 'Students work in pairs on a short Grade 1 task about \"Nouns and Verbs\" (English). They write or draw examples, share with a partner, then present one idea.', NULL, NULL, 10.00, 'ai', 2, 'archived', '{\"categories\":[{\"name\":\"Participation\",\"max_points\":4,\"levels\":[{\"label\":\"Excellent\",\"points\":4,\"description\":\"Fully engaged; helps partner; stays on task.\"},{\"label\":\"Good\",\"points\":3,\"description\":\"Mostly engaged with little prompting.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Needs reminders to stay on task.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Rarely participates or off-task.\"}]},{\"name\":\"Correctness\",\"max_points\":3,\"levels\":[{\"label\":\"Excellent\",\"points\":3,\"description\":\"Ideas clearly match the lesson.\"},{\"label\":\"Good\",\"points\":2,\"description\":\"Mostly accurate with small gaps.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Partial understanding shown.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Little connection to the lesson.\"}]},{\"name\":\"Effort\",\"max_points\":3,\"levels\":[{\"label\":\"Excellent\",\"points\":3,\"description\":\"Complete, neat, thoughtful work.\"},{\"label\":\"Good\",\"points\":2,\"description\":\"Complete with adequate care.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Incomplete or rushed.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Minimal effort.\"}]}]}', '2026-10-07 15:29:36', '2026-10-08 05:50:36'),
(23, 2, 3, 13, 1, 3, 'Sample', 'mcq', 'What is the main idea of \"Sample\" for Grade 1 Science?', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 6, 'archived', NULL, '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(24, 2, 3, 13, 1, 3, 'Sample', 'mcq', 'Which statement best shows understanding of Sample?', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 6, 'archived', NULL, '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(25, 2, 3, 13, 1, 3, 'Sample', 'mcq', 'Based on the objectives, students should practice Sample by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 6, 'archived', NULL, '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(26, 2, 3, 13, 1, 3, 'Sample', 'mcq', 'Based on the objectives, students should practice Sample by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 6, 'archived', NULL, '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(27, 2, 3, 13, 1, 3, 'Sample', 'mcq', 'Based on the objectives, students should practice Sample by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 6, 'archived', NULL, '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(28, 2, 3, 13, 1, 3, 'Sample', 'mcq', 'Based on the objectives, students should practice Sample by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 6, 'archived', NULL, '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(29, 2, 3, 13, 1, 3, 'Sample', 'mcq', 'Based on the objectives, students should practice Sample by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 6, 'archived', NULL, '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(30, 2, 3, 13, 1, 3, 'Sample', 'mcq', 'Based on the objectives, students should practice Sample by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 6, 'archived', NULL, '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(31, 2, 3, 13, 1, 3, 'Sample', 'mcq', 'Based on the objectives, students should practice Sample by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 6, 'archived', NULL, '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(32, 2, 3, 13, 1, 3, 'Sample', 'mcq', 'Based on the objectives, students should practice Sample by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 6, 'archived', NULL, '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(33, 2, 3, 13, 1, 3, 'Sample', 'identification', 'Identify one important term from the lesson \"Sample\".', NULL, 'Key term from Sample', 1.00, 'ai', 6, 'archived', NULL, '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(34, 2, 3, 13, 1, 3, 'Sample', 'identification', 'Name the main skill practiced in \"Sample\" (Science).', NULL, 'Skill from Sample', 1.00, 'ai', 6, 'archived', NULL, '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(35, 2, 3, 13, 1, 3, 'Sample', 'identification', 'Name the main skill practiced in \"Sample\" (Science).', NULL, 'Skill from Sample', 1.00, 'ai', 6, 'archived', NULL, '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(36, 2, 3, 13, 1, 3, 'Sample', 'identification', 'Name the main skill practiced in \"Sample\" (Science).', NULL, 'Skill from Sample', 1.00, 'ai', 6, 'archived', NULL, '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(37, 2, 3, 13, 1, 3, 'Sample', 'identification', 'Name the main skill practiced in \"Sample\" (Science).', NULL, 'Skill from Sample', 1.00, 'ai', 6, 'archived', NULL, '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(38, 2, 3, 13, 1, 3, 'Sample', 'identification', 'Name the main skill practiced in \"Sample\" (Science).', NULL, 'Skill from Sample', 1.00, 'ai', 6, 'archived', NULL, '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(39, 2, 3, 13, 1, 3, 'Sample', 'identification', 'Name the main skill practiced in \"Sample\" (Science).', NULL, 'Skill from Sample', 1.00, 'ai', 6, 'archived', NULL, '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(40, 2, 3, 13, 1, 3, 'Sample', 'identification', 'Name the main skill practiced in \"Sample\" (Science).', NULL, 'Skill from Sample', 1.00, 'ai', 6, 'archived', NULL, '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(41, 2, 3, 13, 1, 3, 'Sample', 'identification', 'Name the main skill practiced in \"Sample\" (Science).', NULL, 'Skill from Sample', 1.00, 'ai', 6, 'archived', NULL, '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(42, 2, 3, 13, 1, 3, 'Sample', 'identification', 'Name the main skill practiced in \"Sample\" (Science).', NULL, 'Skill from Sample', 1.00, 'ai', 6, 'archived', NULL, '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(43, 2, 3, 13, 1, 3, 'Sample', 'enumeration', 'List 2–3 things you learned about \"Sample\".', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 6, 'archived', NULL, '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(44, 2, 3, 13, 1, 3, 'Sample', 'enumeration', 'Enumerate steps or examples related to \"Sample\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 6, 'archived', NULL, '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(45, 2, 3, 13, 1, 3, 'Sample', 'enumeration', 'Enumerate steps or examples related to \"Sample\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 6, 'archived', NULL, '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(46, 2, 3, 13, 1, 3, 'Sample', 'enumeration', 'Enumerate steps or examples related to \"Sample\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 6, 'archived', NULL, '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(47, 2, 3, 13, 1, 3, 'Sample', 'enumeration', 'Enumerate steps or examples related to \"Sample\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 6, 'archived', NULL, '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(48, 2, 3, 13, 1, 3, 'Sample', 'enumeration', 'Enumerate steps or examples related to \"Sample\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 6, 'archived', NULL, '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(49, 2, 3, 13, 1, 3, 'Sample', 'enumeration', 'Enumerate steps or examples related to \"Sample\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 6, 'archived', NULL, '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(50, 2, 3, 13, 1, 3, 'Sample', 'enumeration', 'Enumerate steps or examples related to \"Sample\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 6, 'archived', NULL, '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(51, 2, 3, 13, 1, 3, 'Sample', 'enumeration', 'Enumerate steps or examples related to \"Sample\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 6, 'archived', NULL, '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(52, 2, 3, 13, 1, 3, 'Sample', 'enumeration', 'Enumerate steps or examples related to \"Sample\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 6, 'archived', NULL, '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(53, 2, 3, 13, 1, 3, 'Sample', 'activity', 'Students work in pairs on a short Grade 1 task about \"Sample\" (Science). They write or draw examples, share with a partner, then present one idea.', NULL, NULL, 10.00, 'ai', 6, 'archived', '{\"categories\":[{\"name\":\"Participation\",\"max_points\":4,\"levels\":[{\"label\":\"Excellent\",\"points\":4,\"description\":\"Fully engaged; helps partner; stays on task.\"},{\"label\":\"Good\",\"points\":3,\"description\":\"Mostly engaged with little prompting.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Needs reminders to stay on task.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Rarely participates or off-task.\"}]},{\"name\":\"Correctness\",\"max_points\":3,\"levels\":[{\"label\":\"Excellent\",\"points\":3,\"description\":\"Ideas clearly match the lesson.\"},{\"label\":\"Good\",\"points\":2,\"description\":\"Mostly accurate with small gaps.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Partial understanding shown.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Little connection to the lesson.\"}]},{\"name\":\"Effort\",\"max_points\":3,\"levels\":[{\"label\":\"Excellent\",\"points\":3,\"description\":\"Complete, neat, thoughtful work.\"},{\"label\":\"Good\",\"points\":2,\"description\":\"Complete with adequate care.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Incomplete or rushed.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Minimal effort.\"}]}]}', '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(54, 2, 4, 12, 1, 2, 'Problem Solving', 'mcq', 'What is the main idea of \"Problem Solving\" for Grade 1 Mathematics?', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 4, 'active', NULL, '2026-10-08 00:10:33', '2026-10-08 00:10:33'),
(55, 2, 4, 12, 1, 2, 'Problem Solving', 'mcq', 'Which statement best shows understanding of Problem Solving?', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 4, 'active', NULL, '2026-10-08 00:10:33', '2026-10-08 00:10:33'),
(56, 2, 4, 12, 1, 2, 'Problem Solving', 'mcq', 'Based on the objectives, students should practice Problem Solving by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 4, 'active', NULL, '2026-10-08 00:10:33', '2026-10-08 00:10:33'),
(57, 2, 4, 12, 1, 2, 'Problem Solving', 'mcq', 'Based on the objectives, students should practice Problem Solving by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 4, 'active', NULL, '2026-10-08 00:10:33', '2026-10-08 00:10:33'),
(58, 2, 4, 12, 1, 2, 'Problem Solving', 'identification', 'Identify one important term from the lesson \"Problem Solving\".', NULL, 'Key term from Problem Solving', 1.00, 'ai', 4, 'active', NULL, '2026-10-08 00:10:33', '2026-10-08 00:10:33'),
(59, 2, 4, 12, 1, 2, 'Problem Solving', 'identification', 'Name the main skill practiced in \"Problem Solving\" (Mathematics).', NULL, 'Skill from Problem Solving', 1.00, 'ai', 4, 'active', NULL, '2026-10-08 00:10:33', '2026-10-08 00:10:33'),
(60, 2, 4, 12, 1, 2, 'Problem Solving', 'identification', 'Name the main skill practiced in \"Problem Solving\" (Mathematics).', NULL, 'Skill from Problem Solving', 1.00, 'ai', 4, 'active', NULL, '2026-10-08 00:10:33', '2026-10-08 00:10:33'),
(61, 2, 4, 12, 1, 2, 'Problem Solving', 'enumeration', 'List 2–3 things you learned about \"Problem Solving\".', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 4, 'active', NULL, '2026-10-08 00:10:33', '2026-10-08 00:10:33'),
(62, 2, 4, 12, 1, 2, 'Problem Solving', 'enumeration', 'Enumerate steps or examples related to \"Problem Solving\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 4, 'active', NULL, '2026-10-08 00:10:33', '2026-10-08 00:10:33'),
(63, 2, 4, 12, 1, 2, 'Problem Solving', 'enumeration', 'Enumerate steps or examples related to \"Problem Solving\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 4, 'active', NULL, '2026-10-08 00:10:33', '2026-10-08 00:10:33'),
(64, 2, 4, 12, 1, 2, 'Problem Solving', 'activity', 'Students work in pairs on a short Grade 1 task about \"Problem Solving\" (Mathematics). They write or draw examples, share with a partner, then present one idea.', NULL, NULL, 10.00, 'ai', 4, 'active', '{\"categories\":[{\"name\":\"Participation\",\"max_points\":4,\"levels\":[{\"label\":\"Excellent\",\"points\":4,\"description\":\"Fully engaged; helps partner; stays on task.\"},{\"label\":\"Good\",\"points\":3,\"description\":\"Mostly engaged with little prompting.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Needs reminders to stay on task.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Rarely participates or off-task.\"}]},{\"name\":\"Correctness\",\"max_points\":3,\"levels\":[{\"label\":\"Excellent\",\"points\":3,\"description\":\"Ideas clearly match the lesson.\"},{\"label\":\"Good\",\"points\":2,\"description\":\"Mostly accurate with small gaps.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Partial understanding shown.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Little connection to the lesson.\"}]},{\"name\":\"Effort\",\"max_points\":3,\"levels\":[{\"label\":\"Excellent\",\"points\":3,\"description\":\"Complete, neat, thoughtful work.\"},{\"label\":\"Good\",\"points\":2,\"description\":\"Complete with adequate care.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Incomplete or rushed.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Minimal effort.\"}]}]}', '2026-10-08 00:10:33', '2026-10-08 00:10:33'),
(65, 2, 5, 16, 1, 4, 'Adjective', 'mcq', 'What is the main idea of \"Adjective\" for Grade 1 English?', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 7, 'archived', NULL, '2026-10-08 00:18:09', '2026-10-08 00:19:14'),
(66, 2, 5, 16, 1, 4, 'Adjective', 'mcq', 'Which statement best shows understanding of Adjective?', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 7, 'archived', NULL, '2026-10-08 00:18:09', '2026-10-08 00:19:14'),
(67, 2, 5, 16, 1, 4, 'Adjective', 'mcq', 'Based on the objectives, students should practice Adjective by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 7, 'archived', NULL, '2026-10-08 00:18:09', '2026-10-08 00:19:14'),
(68, 2, 5, 16, 1, 4, 'Adjective', 'mcq', 'Based on the objectives, students should practice Adjective by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 7, 'archived', NULL, '2026-10-08 00:18:09', '2026-10-08 00:19:14'),
(69, 2, 5, 16, 1, 4, 'Adjective', 'mcq', 'Based on the objectives, students should practice Adjective by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 7, 'archived', NULL, '2026-10-08 00:18:09', '2026-10-08 00:19:14'),
(70, 2, 5, 16, 1, 4, 'Adjective', 'mcq', 'Based on the objectives, students should practice Adjective by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 7, 'archived', NULL, '2026-10-08 00:18:09', '2026-10-08 00:19:14'),
(71, 2, 5, 16, 1, 4, 'Adjective', 'mcq', 'Based on the objectives, students should practice Adjective by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 7, 'archived', NULL, '2026-10-08 00:18:09', '2026-10-08 00:19:14'),
(72, 2, 5, 16, 1, 4, 'Adjective', 'mcq', 'Based on the objectives, students should practice Adjective by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 7, 'archived', NULL, '2026-10-08 00:18:09', '2026-10-08 00:19:14'),
(73, 2, 5, 16, 1, 4, 'Adjective', 'mcq', 'Based on the objectives, students should practice Adjective by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 7, 'archived', NULL, '2026-10-08 00:18:09', '2026-10-08 00:19:14'),
(74, 2, 5, 16, 1, 4, 'Adjective', 'mcq', 'Based on the objectives, students should practice Adjective by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 7, 'archived', NULL, '2026-10-08 00:18:09', '2026-10-08 00:19:14'),
(75, 2, 5, 16, 1, 4, 'Adjective', 'identification', 'Identify one important term from the lesson \"Adjective\".', NULL, 'Key term from Adjective', 1.00, 'ai', 7, 'archived', NULL, '2026-10-08 00:18:09', '2026-10-08 00:19:14'),
(76, 2, 5, 16, 1, 4, 'Adjective', 'identification', 'Name the main skill practiced in \"Adjective\" (English).', NULL, 'Skill from Adjective', 1.00, 'ai', 7, 'archived', NULL, '2026-10-08 00:18:09', '2026-10-08 00:19:14'),
(77, 2, 5, 16, 1, 4, 'Adjective', 'identification', 'Name the main skill practiced in \"Adjective\" (English).', NULL, 'Skill from Adjective', 1.00, 'ai', 7, 'archived', NULL, '2026-10-08 00:18:09', '2026-10-08 00:19:14'),
(78, 2, 5, 16, 1, 4, 'Adjective', 'identification', 'Name the main skill practiced in \"Adjective\" (English).', NULL, 'Skill from Adjective', 1.00, 'ai', 7, 'archived', NULL, '2026-10-08 00:18:09', '2026-10-08 00:19:14'),
(79, 2, 5, 16, 1, 4, 'Adjective', 'identification', 'Name the main skill practiced in \"Adjective\" (English).', NULL, 'Skill from Adjective', 1.00, 'ai', 7, 'archived', NULL, '2026-10-08 00:18:09', '2026-10-08 00:19:14'),
(80, 2, 5, 16, 1, 4, 'Adjective', 'identification', 'Name the main skill practiced in \"Adjective\" (English).', NULL, 'Skill from Adjective', 1.00, 'ai', 7, 'archived', NULL, '2026-10-08 00:18:09', '2026-10-08 00:19:14'),
(81, 2, 5, 16, 1, 4, 'Adjective', 'identification', 'Name the main skill practiced in \"Adjective\" (English).', NULL, 'Skill from Adjective', 1.00, 'ai', 7, 'archived', NULL, '2026-10-08 00:18:09', '2026-10-08 00:19:14'),
(82, 2, 5, 16, 1, 4, 'Adjective', 'identification', 'Name the main skill practiced in \"Adjective\" (English).', NULL, 'Skill from Adjective', 1.00, 'ai', 7, 'archived', NULL, '2026-10-08 00:18:09', '2026-10-08 00:19:14'),
(83, 2, 5, 16, 1, 4, 'Adjective', 'identification', 'Name the main skill practiced in \"Adjective\" (English).', NULL, 'Skill from Adjective', 1.00, 'ai', 7, 'archived', NULL, '2026-10-08 00:18:09', '2026-10-08 00:19:14'),
(84, 2, 5, 16, 1, 4, 'Adjective', 'identification', 'Name the main skill practiced in \"Adjective\" (English).', NULL, 'Skill from Adjective', 1.00, 'ai', 7, 'archived', NULL, '2026-10-08 00:18:09', '2026-10-08 00:19:14'),
(85, 2, 5, 16, 1, 4, 'Adjective', 'enumeration', 'List 2–3 things you learned about \"Adjective\".', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 7, 'archived', NULL, '2026-10-08 00:18:09', '2026-10-08 00:19:14'),
(86, 2, 5, 16, 1, 4, 'Adjective', 'enumeration', 'Enumerate steps or examples related to \"Adjective\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 7, 'archived', NULL, '2026-10-08 00:18:09', '2026-10-08 00:19:14'),
(87, 2, 5, 16, 1, 4, 'Adjective', 'enumeration', 'Enumerate steps or examples related to \"Adjective\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 7, 'archived', NULL, '2026-10-08 00:18:09', '2026-10-08 00:19:14'),
(88, 2, 5, 16, 1, 4, 'Adjective', 'enumeration', 'Enumerate steps or examples related to \"Adjective\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 7, 'archived', NULL, '2026-10-08 00:18:09', '2026-10-08 00:19:14'),
(89, 2, 5, 16, 1, 4, 'Adjective', 'enumeration', 'Enumerate steps or examples related to \"Adjective\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 7, 'archived', NULL, '2026-10-08 00:18:09', '2026-10-08 00:19:14'),
(90, 2, 5, 16, 1, 4, 'Adjective', 'enumeration', 'Enumerate steps or examples related to \"Adjective\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 7, 'archived', NULL, '2026-10-08 00:18:09', '2026-10-08 00:19:14'),
(91, 2, 5, 16, 1, 4, 'Adjective', 'enumeration', 'Enumerate steps or examples related to \"Adjective\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 7, 'archived', NULL, '2026-10-08 00:18:09', '2026-10-08 00:19:14'),
(92, 2, 5, 16, 1, 4, 'Adjective', 'enumeration', 'Enumerate steps or examples related to \"Adjective\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 7, 'archived', NULL, '2026-10-08 00:18:09', '2026-10-08 00:19:14'),
(93, 2, 5, 16, 1, 4, 'Adjective', 'enumeration', 'Enumerate steps or examples related to \"Adjective\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 7, 'archived', NULL, '2026-10-08 00:18:09', '2026-10-08 00:19:14'),
(94, 2, 5, 16, 1, 4, 'Adjective', 'enumeration', 'Enumerate steps or examples related to \"Adjective\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 7, 'archived', NULL, '2026-10-08 00:18:10', '2026-10-08 00:19:14'),
(95, 2, 5, 16, 1, 4, 'Adjective', 'activity', 'Students work in pairs on a short Grade 1 task about \"Adjective\" (English). They write or draw examples, share with a partner, then present one idea.', NULL, NULL, 10.00, 'ai', 7, 'archived', '{\"categories\":[{\"name\":\"Participation\",\"max_points\":4,\"levels\":[{\"label\":\"Excellent\",\"points\":4,\"description\":\"Fully engaged; helps partner; stays on task.\"},{\"label\":\"Good\",\"points\":3,\"description\":\"Mostly engaged with little prompting.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Needs reminders to stay on task.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Rarely participates or off-task.\"}]},{\"name\":\"Correctness\",\"max_points\":3,\"levels\":[{\"label\":\"Excellent\",\"points\":3,\"description\":\"Ideas clearly match the lesson.\"},{\"label\":\"Good\",\"points\":2,\"description\":\"Mostly accurate with small gaps.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Partial understanding shown.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Little connection to the lesson.\"}]},{\"name\":\"Effort\",\"max_points\":3,\"levels\":[{\"label\":\"Excellent\",\"points\":3,\"description\":\"Complete, neat, thoughtful work.\"},{\"label\":\"Good\",\"points\":2,\"description\":\"Complete with adequate care.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Incomplete or rushed.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Minimal effort.\"}]}]}', '2026-10-08 00:18:10', '2026-10-08 00:19:14'),
(96, 2, 6, 16, 1, 5, 'Internet of Things', 'mcq', 'What is the main idea of \"Internet of Things\" for Grade 1 English?', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 8, 'archived', NULL, '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(97, 2, 6, 16, 1, 5, 'Internet of Things', 'mcq', 'Which statement best shows understanding of Internet of Things?', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 8, 'archived', NULL, '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(98, 2, 6, 16, 1, 5, 'Internet of Things', 'mcq', 'Based on the objectives, students should practice Internet of Things by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 8, 'archived', NULL, '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(99, 2, 6, 16, 1, 5, 'Internet of Things', 'mcq', 'Based on the objectives, students should practice Internet of Things by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 8, 'archived', NULL, '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(100, 2, 6, 16, 1, 5, 'Internet of Things', 'mcq', 'Based on the objectives, students should practice Internet of Things by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 8, 'archived', NULL, '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(101, 2, 6, 16, 1, 5, 'Internet of Things', 'mcq', 'Based on the objectives, students should practice Internet of Things by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 8, 'archived', NULL, '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(102, 2, 6, 16, 1, 5, 'Internet of Things', 'mcq', 'Based on the objectives, students should practice Internet of Things by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 8, 'archived', NULL, '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(103, 2, 6, 16, 1, 5, 'Internet of Things', 'mcq', 'Based on the objectives, students should practice Internet of Things by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 8, 'archived', NULL, '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(104, 2, 6, 16, 1, 5, 'Internet of Things', 'mcq', 'Based on the objectives, students should practice Internet of Things by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 8, 'archived', NULL, '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(105, 2, 6, 16, 1, 5, 'Internet of Things', 'mcq', 'Based on the objectives, students should practice Internet of Things by:', '[\"A key concept from the lesson\",\"An unrelated topic\",\"A homework rule\",\"A recess activity\"]', 'A key concept from the lesson', 1.00, 'ai', 8, 'archived', NULL, '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(106, 2, 6, 16, 1, 5, 'Internet of Things', 'identification', 'Identify one important term from the lesson \"Internet of Things\".', NULL, 'Key term from Internet of Things', 1.00, 'ai', 8, 'archived', NULL, '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(107, 2, 6, 16, 1, 5, 'Internet of Things', 'identification', 'Name the main skill practiced in \"Internet of Things\" (English).', NULL, 'Skill from Internet of Things', 1.00, 'ai', 8, 'archived', NULL, '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(108, 2, 6, 16, 1, 5, 'Internet of Things', 'identification', 'Name the main skill practiced in \"Internet of Things\" (English).', NULL, 'Skill from Internet of Things', 1.00, 'ai', 8, 'archived', NULL, '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(109, 2, 6, 16, 1, 5, 'Internet of Things', 'identification', 'Name the main skill practiced in \"Internet of Things\" (English).', NULL, 'Skill from Internet of Things', 1.00, 'ai', 8, 'archived', NULL, '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(110, 2, 6, 16, 1, 5, 'Internet of Things', 'identification', 'Name the main skill practiced in \"Internet of Things\" (English).', NULL, 'Skill from Internet of Things', 1.00, 'ai', 8, 'archived', NULL, '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(111, 2, 6, 16, 1, 5, 'Internet of Things', 'identification', 'Name the main skill practiced in \"Internet of Things\" (English).', NULL, 'Skill from Internet of Things', 1.00, 'ai', 8, 'archived', NULL, '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(112, 2, 6, 16, 1, 5, 'Internet of Things', 'identification', 'Name the main skill practiced in \"Internet of Things\" (English).', NULL, 'Skill from Internet of Things', 1.00, 'ai', 8, 'archived', NULL, '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(113, 2, 6, 16, 1, 5, 'Internet of Things', 'identification', 'Name the main skill practiced in \"Internet of Things\" (English).', NULL, 'Skill from Internet of Things', 1.00, 'ai', 8, 'archived', NULL, '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(114, 2, 6, 16, 1, 5, 'Internet of Things', 'identification', 'Name the main skill practiced in \"Internet of Things\" (English).', NULL, 'Skill from Internet of Things', 1.00, 'ai', 8, 'archived', NULL, '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(115, 2, 6, 16, 1, 5, 'Internet of Things', 'identification', 'Name the main skill practiced in \"Internet of Things\" (English).', NULL, 'Skill from Internet of Things', 1.00, 'ai', 8, 'archived', NULL, '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(116, 2, 6, 16, 1, 5, 'Internet of Things', 'enumeration', 'List 2–3 things you learned about \"Internet of Things\".', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 8, 'archived', NULL, '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(117, 2, 6, 16, 1, 5, 'Internet of Things', 'enumeration', 'Enumerate steps or examples related to \"Internet of Things\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 8, 'archived', NULL, '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(118, 2, 6, 16, 1, 5, 'Internet of Things', 'enumeration', 'Enumerate steps or examples related to \"Internet of Things\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 8, 'archived', NULL, '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(119, 2, 6, 16, 1, 5, 'Internet of Things', 'enumeration', 'Enumerate steps or examples related to \"Internet of Things\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 8, 'archived', NULL, '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(120, 2, 6, 16, 1, 5, 'Internet of Things', 'enumeration', 'Enumerate steps or examples related to \"Internet of Things\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 8, 'archived', NULL, '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(121, 2, 6, 16, 1, 5, 'Internet of Things', 'enumeration', 'Enumerate steps or examples related to \"Internet of Things\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 8, 'archived', NULL, '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(122, 2, 6, 16, 1, 5, 'Internet of Things', 'enumeration', 'Enumerate steps or examples related to \"Internet of Things\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 8, 'archived', NULL, '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(123, 2, 6, 16, 1, 5, 'Internet of Things', 'enumeration', 'Enumerate steps or examples related to \"Internet of Things\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 8, 'archived', NULL, '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(124, 2, 6, 16, 1, 5, 'Internet of Things', 'enumeration', 'Enumerate steps or examples related to \"Internet of Things\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 8, 'archived', NULL, '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(125, 2, 6, 16, 1, 5, 'Internet of Things', 'enumeration', 'Enumerate steps or examples related to \"Internet of Things\" for Grade 1.', NULL, 'Possible answers: concepts or steps from the lesson objectives', 2.00, 'ai', 8, 'archived', NULL, '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(126, 2, 6, 16, 1, 5, 'Internet of Things', 'activity', 'Students work in pairs on a short Grade 1 task about \"Internet of Things\" (English). They write or draw examples, share with a partner, then present one idea.', NULL, NULL, 10.00, 'ai', 8, 'archived', '{\"categories\":[{\"name\":\"Participation\",\"max_points\":4,\"levels\":[{\"label\":\"Excellent\",\"points\":4,\"description\":\"Fully engaged; helps partner; stays on task.\"},{\"label\":\"Good\",\"points\":3,\"description\":\"Mostly engaged with little prompting.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Needs reminders to stay on task.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Rarely participates or off-task.\"}]},{\"name\":\"Correctness\",\"max_points\":3,\"levels\":[{\"label\":\"Excellent\",\"points\":3,\"description\":\"Ideas clearly match the lesson.\"},{\"label\":\"Good\",\"points\":2,\"description\":\"Mostly accurate with small gaps.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Partial understanding shown.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Little connection to the lesson.\"}]},{\"name\":\"Effort\",\"max_points\":3,\"levels\":[{\"label\":\"Excellent\",\"points\":3,\"description\":\"Complete, neat, thoughtful work.\"},{\"label\":\"Good\",\"points\":2,\"description\":\"Complete with adequate care.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Incomplete or rushed.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Minimal effort.\"}]}]}', '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(127, 2, 7, 16, 1, 1, 'Nouns and Verbs', 'mcq', 'What is a noun?', '[\"A person\",\"A place\",\"A thing\",\"A action\"]', 'A thing', 1.00, 'ai', 10, 'archived', NULL, '2026-10-08 01:01:56', '2026-10-08 05:50:08'),
(128, 2, 7, 16, 1, 1, 'Nouns and Verbs', 'identification', 'What is the verb \'run\'?', NULL, 'To move quickly on foot', 1.00, 'ai', 10, 'archived', NULL, '2026-10-08 01:01:56', '2026-10-08 05:50:08'),
(129, 2, 7, 16, 1, 1, 'Nouns and Verbs', 'enumeration', 'List the types of nouns:', NULL, 'Person, place, thing, animal, food, time, date, event, object, idea', 2.00, 'ai', 10, 'archived', NULL, '2026-10-08 01:01:56', '2026-10-08 05:50:08'),
(130, 2, 7, 16, 1, 1, 'Nouns and Verbs', 'mcq', 'What is a verb?', '[\"A person\",\"A place\",\"A thing\",\"A action\"]', 'A action', 1.00, 'ai', 10, 'archived', NULL, '2026-10-08 01:01:56', '2026-10-08 05:50:08'),
(131, 2, 7, 16, 1, 1, 'Nouns and Verbs', 'identification', 'What is the verb \'jump\'?', NULL, 'To move upward quickly', 1.00, 'ai', 10, 'archived', NULL, '2026-10-08 01:01:56', '2026-10-08 05:50:08'),
(132, 2, 7, 16, 1, 1, 'Nouns and Verbs', 'enumeration', 'List the types of verbs:', NULL, 'Action, linking, helping, transitive, intransitive', 2.00, 'ai', 10, 'archived', NULL, '2026-10-08 01:01:56', '2026-10-08 05:50:08'),
(133, 2, 7, 16, 1, 1, 'Nouns and Verbs', 'mcq', 'What is a noun phrase?', '[\"A group of words\",\"A single word\",\"A sentence\",\"A paragraph\"]', 'A group of words', 1.00, 'ai', 10, 'archived', NULL, '2026-10-08 01:01:56', '2026-10-08 05:50:08'),
(134, 2, 7, 16, 1, 1, 'Nouns and Verbs', 'identification', 'What is the noun phrase \'the big red car\'?', NULL, 'A car', 1.00, 'ai', 10, 'archived', NULL, '2026-10-08 01:01:56', '2026-10-08 05:50:08'),
(135, 2, 7, 16, 1, 1, 'Nouns and Verbs', 'enumeration', 'List the parts of a verb:', NULL, 'Root, prefix, suffix, tense, voice, mood', 2.00, 'ai', 10, 'archived', NULL, '2026-10-08 01:01:56', '2026-10-08 05:50:08'),
(136, 2, 7, 16, 1, 1, 'Nouns and Verbs', 'mcq', 'What is a verb tense?', '[\"A way of speaking\",\"A way of writing\",\"A way of describing time\",\"A way of describing place\"]', 'A way of describing time', 1.00, 'ai', 10, 'archived', NULL, '2026-10-08 01:01:56', '2026-10-08 05:50:08'),
(137, 2, 7, 16, 1, 1, 'Nouns and Verbs', 'activity', 'Students work in pairs on a short Grade 1 task about \"Nouns and Verbs\" (English). They write or draw examples, share with a partner, then present one idea.', NULL, NULL, 10.00, 'ai', 10, 'archived', '{\"categories\":[{\"name\":\"Participation\",\"max_points\":4,\"levels\":[{\"label\":\"Excellent\",\"points\":4,\"description\":\"Fully engaged; helps partner; stays on task.\"},{\"label\":\"Good\",\"points\":3,\"description\":\"Mostly engaged with little prompting.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Needs reminders to stay on task.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Rarely participates or off-task.\"}]},{\"name\":\"Correctness\",\"max_points\":3,\"levels\":[{\"label\":\"Excellent\",\"points\":3,\"description\":\"Ideas clearly match the lesson.\"},{\"label\":\"Good\",\"points\":2,\"description\":\"Mostly accurate with small gaps.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Partial understanding shown.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Little connection to the lesson.\"}]},{\"name\":\"Effort\",\"max_points\":3,\"levels\":[{\"label\":\"Excellent\",\"points\":3,\"description\":\"Complete, neat, thoughtful work.\"},{\"label\":\"Good\",\"points\":2,\"description\":\"Complete with adequate care.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Incomplete or rushed.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Minimal effort.\"}]}]}', '2026-10-08 01:01:56', '2026-10-08 05:50:08'),
(138, 2, 8, 16, 1, 6, 'Nouns', 'mcq', 'What are people, places, or things called?', '[\"Things\",\"People\",\"Nouns\"]', 'Nouns', 1.00, 'ai', NULL, 'active', NULL, '2026-10-08 05:52:01', '2026-10-08 05:52:01'),
(139, 2, 8, 16, 1, 6, 'Nouns', 'mcq', 'What do pronouns replace in a sentence?', '[\"Object\",\"Subject\",\"Noun\"]', 'Subject', 1.00, 'ai', NULL, 'active', NULL, '2026-10-08 05:52:01', '2026-10-08 05:52:01'),
(140, 2, 8, 16, 1, 6, 'Nouns', 'mcq', 'What do adverbs modify?', '[\"Verbs\",\"Adjectives\",\"Nouns\"]', 'Verbs', 1.00, 'ai', NULL, 'active', NULL, '2026-10-08 05:52:01', '2026-10-08 05:52:01'),
(141, 2, 8, 16, 1, 6, 'Nouns', 'mcq', 'What are action words called?', '[\"Verbs\",\"Adjectives\",\"Nouns\"]', 'Verbs', 1.00, 'ai', NULL, 'active', NULL, '2026-10-08 05:52:01', '2026-10-08 05:52:01'),
(142, 2, 8, 16, 1, 6, 'Nouns', 'mcq', 'What do adverbs help with?', '[\"Verb usage\",\"Sentence structure\",\"Verb meaning\"]', 'Verb usage', 1.00, 'ai', NULL, 'active', NULL, '2026-10-08 05:52:01', '2026-10-08 05:52:01'),
(143, 2, 8, 16, 1, 6, 'Nouns', 'mcq', 'What do verbs can be in?', '[\"Tenses\",\"Parts of speech\",\"Sentences\"]', 'Tenses', 1.00, 'ai', NULL, 'active', NULL, '2026-10-08 05:52:01', '2026-10-08 05:52:01'),
(144, 2, 8, 16, 1, 6, 'Nouns', 'mcq', 'What introduces adjectives?', '[\"A helping verb\",\"A noun\",\"A verb\"]', 'A helping verb', 1.00, 'ai', NULL, 'active', NULL, '2026-10-08 05:52:01', '2026-10-08 05:52:01'),
(145, 2, 8, 16, 1, 6, 'Nouns', 'mcq', 'What are adjectives?', '[\"Descriptive words\",\"A type of noun\",\"A type of verb\"]', 'Descriptive words', 1.00, 'ai', NULL, 'active', NULL, '2026-10-08 05:52:01', '2026-10-08 05:52:01'),
(146, 2, 9, 16, 1, 6, 'Nouns', 'mcq', 'What is a noun?', '[\"A person\",\"A place\",\"A thing\",\"A verb\"]', '3', 1.00, 'ai', 12, 'active', NULL, '2026-10-09 00:50:41', '2026-10-09 00:50:41'),
(147, 2, 9, 16, 1, 6, 'Nouns', 'identification', 'What is the noun in the sentence \'The girl is reading a book\'?', NULL, 'girl', 1.00, 'ai', 12, 'active', NULL, '2026-10-09 00:50:41', '2026-10-09 00:50:41'),
(148, 2, 9, 16, 1, 6, 'Nouns', 'enumeration', 'List 3 types of nouns (tangible or abstract).', NULL, '1. Dog, 2. Happiness, 3. France', 2.00, 'ai', 12, 'active', NULL, '2026-10-09 00:50:41', '2026-10-09 00:50:41'),
(149, 2, 9, 16, 1, 6, 'Nouns', 'mcq', 'Is \'she\' a subject pronoun or an object pronoun in the sentence \'She is a princess\'?', '[\"Subject pronoun\",\"Object pronoun\",\"Both\",\"Neither\"]', '1', 1.00, 'ai', 12, 'active', NULL, '2026-10-09 00:50:41', '2026-10-09 00:50:41'),
(150, 2, 9, 16, 1, 6, 'Nouns', 'identification', 'What is the adjective in the sentence \'Elsa is blonde\'?', NULL, 'blonde', 1.00, 'ai', 12, 'active', NULL, '2026-10-09 00:50:41', '2026-10-09 00:50:41'),
(151, 2, 9, 16, 1, 6, 'Nouns', 'enumeration', 'List 2 types of adjectives.', NULL, '1. Descriptive, 2. Quantitative', 2.00, 'ai', 12, 'active', NULL, '2026-10-09 00:50:41', '2026-10-09 00:50:41'),
(152, 2, 9, 16, 1, 6, 'Nouns', 'mcq', 'Is \'he\' a subject pronoun or an object pronoun in the sentence \'He is a boy\'?', '[\"Subject pronoun\",\"Object pronoun\",\"Both\",\"Neither\"]', '1', 1.00, 'ai', 12, 'active', NULL, '2026-10-09 00:50:41', '2026-10-09 00:50:41'),
(153, 2, 9, 16, 1, 6, 'Nouns', 'identification', 'What is the verb in the sentence \'Batman drives the Batmobile\'?', NULL, 'drives', 1.00, 'ai', 12, 'active', NULL, '2026-10-09 00:50:41', '2026-10-09 00:50:41'),
(154, 2, 9, 16, 1, 6, 'Nouns', 'enumeration', 'List 3 types of verb tenses.', NULL, '1. Past tense, 2. Present tense, 3. Future tense', 2.00, 'ai', 12, 'active', NULL, '2026-10-09 00:50:41', '2026-10-09 00:50:41'),
(155, 2, 9, 16, 1, 6, 'Nouns', 'mcq', 'Is \'she\' a subject pronoun or an object pronoun in the sentence \'She is a princess\'?', '[\"Subject pronoun\",\"Object pronoun\",\"Both\",\"Neither\"]', '1', 1.00, 'ai', 12, 'active', NULL, '2026-10-09 00:50:41', '2026-10-09 00:50:41');
INSERT INTO `question_bank` (`id`, `teacher_id`, `quiz_set_id`, `subject_id`, `grade_level`, `lesson_plan_id`, `lesson_title`, `item_type`, `question`, `choices`, `answer`, `points`, `source`, `ai_recommendation_id`, `status`, `rubric`, `created_at`, `updated_at`) VALUES
(156, 2, 9, 16, 1, 6, 'Nouns', 'activity', 'Sort the following nouns into categories: tangible, abstract, singular, or plural. Use the vocabulary and sentence structures learned in class.', NULL, NULL, 5.00, 'ai', 12, 'active', '{\"categories\":[{\"name\":\"Accuracy\",\"max_points\":5,\"levels\":[{\"label\":\"Excellent\",\"points\":5,\"description\":\"All nouns are correctly sorted into categories.\"},{\"label\":\"Good\",\"points\":3,\"description\":\"Most nouns are correctly sorted, but some may be incorrect.\"},{\"label\":\"Fair\",\"points\":1,\"description\":\"Some nouns are correctly sorted, but many are incorrect.\"},{\"label\":\"Needs Improvement\",\"points\":2,\"description\":\"Most nouns are incorrectly sorted.\"}]}]}', '2026-10-09 00:50:41', '2026-10-09 00:50:41'),
(157, 2, 10, 13, 1, 3, 'Sample', 'mcq', 'What is a noun?', '[\"A person, place, or thing\",\"A verb\",\"An adjective\",\"A pronoun\"]', 'A person, place, or thing', 1.00, 'ai', 13, 'active', NULL, '2026-10-09 03:49:59', '2026-10-09 03:49:59'),
(158, 2, 10, 13, 1, 3, 'Sample', 'mcq', 'What is a verb?', '[\"An action word\",\"A descriptive word\",\"A pronoun\",\"An adjective\"]', 'An action word', 1.00, 'ai', 13, 'active', NULL, '2026-10-09 03:49:59', '2026-10-09 03:49:59'),
(159, 2, 10, 13, 1, 3, 'Sample', 'mcq', 'What is an adjective?', '[\"A word that describes a noun\",\"A word that modifies a verb\",\"A word that is a pronoun\",\"A word that is an adverb\"]', 'A word that describes a noun', 1.00, 'ai', 13, 'active', NULL, '2026-10-09 03:49:59', '2026-10-09 03:49:59'),
(160, 2, 10, 13, 1, 3, 'Sample', 'mcq', 'What type of noun refers to only one person, place, or thing?', '[\"Proper\",\"Common\",\"Singular\",\"Plural\"]', 'Singular', 1.00, 'ai', 13, 'active', NULL, '2026-10-09 03:49:59', '2026-10-09 03:49:59'),
(161, 2, 10, 13, 1, 3, 'Sample', 'mcq', 'What type of noun refers to more than one person, place, or thing?', '[\"Proper\",\"Common\",\"Singular\",\"Plural\"]', 'Plural', 1.00, 'ai', 13, 'active', NULL, '2026-10-09 03:49:59', '2026-10-09 03:49:59'),
(162, 2, 10, 13, 1, 3, 'Sample', 'mcq', 'What is a pronoun?', '[\"A word that replaces a noun\",\"A word that modifies a verb\",\"A word that is an adjective\",\"A word that is an adverb\"]', 'A word that replaces a noun', 1.00, 'ai', 13, 'active', NULL, '2026-10-09 03:49:59', '2026-10-09 03:49:59'),
(163, 2, 10, 13, 1, 3, 'Sample', 'mcq', 'What type of word describes a noun?', '[\"Adjective\",\"Adverb\",\"Pronoun\",\"Verb\"]', 'Adjective', 1.00, 'ai', 13, 'active', NULL, '2026-10-09 03:49:59', '2026-10-09 03:49:59'),
(164, 2, 10, 13, 1, 3, 'Sample', 'mcq', 'What type of word modifies a verb?', '[\"Adjective\",\"Adverb\",\"Pronoun\",\"Verb\"]', 'Adverb', 1.00, 'ai', 13, 'active', NULL, '2026-10-09 03:49:59', '2026-10-09 03:49:59'),
(165, 2, 10, 13, 1, 3, 'Sample', 'mcq', 'What is a helping verb?', '[\"A verb that helps to extend the meaning of another verb\",\"A verb that modifies a noun\",\"A verb that is an adjective\",\"A verb that is an adverb\"]', 'A verb that helps to extend the meaning of another verb', 1.00, 'ai', 13, 'active', NULL, '2026-10-09 03:49:59', '2026-10-09 03:49:59'),
(166, 2, 10, 13, 1, 3, 'Sample', 'mcq', 'What is an adverb?', '[\"A word that modifies a verb\",\"A word that modifies an adjective\",\"A word that is a pronoun\",\"A word that is a noun\"]', 'A word that modifies a verb', 1.00, 'ai', 13, 'active', NULL, '2026-10-09 03:49:59', '2026-10-09 03:49:59'),
(167, 2, 10, 13, 1, 3, 'Sample', 'activity', 'Sort the following words into their correct categories: noun, verb, adjective, pronoun, and adverb. Use the definitions provided to help you make your decisions.', NULL, NULL, 5.00, 'ai', 13, 'active', '{\"categories\":[{\"name\":\"Accuracy\",\"max_points\":5,\"levels\":[{\"label\":\"Excellent\",\"points\":5,\"description\":\"All words are correctly sorted into their categories.\"},{\"label\":\"Good\",\"points\":3,\"description\":\"Most words are correctly sorted, but some may be misplaced.\"},{\"label\":\"Fair\",\"points\":1,\"description\":\"Some words are correctly sorted, but many are misplaced.\"},{\"label\":\"Needs Improvement\",\"points\":2,\"description\":\"Most words are incorrectly sorted.\"}]}]}', '2026-10-09 03:49:59', '2026-10-09 03:49:59'),
(168, 2, 11, 16, 1, 6, 'Nouns', 'mcq', 'What is a general word for a person, place, or thing?', '[\"A proper noun\",\"A singular noun\",\"A plural noun\",\"A general word for people, places, or things\"]', 'A general word for people, places, or things', 1.00, 'ai', 17, 'active', NULL, '2026-10-09 04:44:30', '2026-10-09 04:44:30'),
(169, 2, 11, 16, 1, 6, 'Nouns', 'identification', 'Name one type of noun that refers to a tangible or touchable thing.', NULL, 'Tangible noun', 1.00, 'ai', 17, 'active', NULL, '2026-10-09 04:44:30', '2026-10-09 04:44:30'),
(170, 2, 11, 16, 1, 6, 'Nouns', 'enumeration', 'List three types of nouns.', NULL, 'Proper nouns, Common nouns, Abstract nouns', 3.00, 'ai', 17, 'active', NULL, '2026-10-09 04:44:30', '2026-10-09 04:44:30'),
(171, 2, 11, 16, 1, 6, 'Nouns', 'activity', 'Students work in pairs on a short Grade 1 task about \"Nouns\" (English). They write or draw examples, share with a partner, then present one idea.', NULL, NULL, 10.00, 'ai', 17, 'active', '{\"categories\":[{\"name\":\"Participation\",\"max_points\":4,\"levels\":[{\"label\":\"Excellent\",\"points\":4,\"description\":\"Fully engaged; helps partner; stays on task.\"},{\"label\":\"Good\",\"points\":3,\"description\":\"Mostly engaged with little prompting.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Needs reminders to stay on task.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Rarely participates or off-task.\"}]},{\"name\":\"Correctness\",\"max_points\":3,\"levels\":[{\"label\":\"Excellent\",\"points\":3,\"description\":\"Ideas clearly match the lesson.\"},{\"label\":\"Good\",\"points\":2,\"description\":\"Mostly accurate with small gaps.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Partial understanding shown.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Little connection to the lesson.\"}]},{\"name\":\"Effort\",\"max_points\":3,\"levels\":[{\"label\":\"Excellent\",\"points\":3,\"description\":\"Complete, neat, thoughtful work.\"},{\"label\":\"Good\",\"points\":2,\"description\":\"Complete with adequate care.\"},{\"label\":\"Fair\",\"points\":2,\"description\":\"Incomplete or rushed.\"},{\"label\":\"Needs Improvement\",\"points\":1,\"description\":\"Minimal effort.\"}]}]}', '2026-10-09 04:44:30', '2026-10-09 04:44:30');

-- --------------------------------------------------------

--
-- Table structure for table `quizgen_facts`
--

CREATE TABLE `quizgen_facts` (
  `id` int(11) NOT NULL,
  `lesson_plan_id` int(11) NOT NULL,
  `file_hash` char(40) NOT NULL,
  `chunk_id` varchar(16) NOT NULL,
  `page_ref` varchar(64) DEFAULT NULL,
  `fact` text NOT NULL,
  `source_quote` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `quizgen_facts`
--

INSERT INTO `quizgen_facts` (`id`, `lesson_plan_id`, `file_hash`, `chunk_id`, `page_ref`, `fact`, `source_quote`, `created_at`) VALUES
(1, 6, '6ec9f5dbecd8ef6d9793a9ac23f183b9f2b0c6fa', 'c1', 'p.1', 'Nouns are people, places, or things.', 'Nouns are people, places, or things.', '2026-10-08 05:32:01'),
(2, 6, '6ec9f5dbecd8ef6d9793a9ac23f183b9f2b0c6fa', 'c1', 'p.1', 'Verbs are action words.', 'Verbs are action words.', '2026-10-08 05:32:01'),
(3, 6, '6ec9f5dbecd8ef6d9793a9ac23f183b9f2b0c6fa', 'c1', 'p.1', 'Adjectives are descriptive words.', 'Adjectives are descriptive words.', '2026-10-08 05:32:01'),
(4, 6, '6ec9f5dbecd8ef6d9793a9ac23f183b9f2b0c6fa', 'c1', 'p.1', 'A noun is a part of speech that signifies a person, place, or thing.', 'A noun is a part of speech that signifies a person, place, or thing.', '2026-10-08 05:32:01'),
(5, 6, '6ec9f5dbecd8ef6d9793a9ac23f183b9f2b0c6fa', 'c1', 'p.1', 'Nouns can be singular or plural.', 'Nouns can also be singular or plural.', '2026-10-08 05:32:01'),
(6, 6, '6ec9f5dbecd8ef6d9793a9ac23f183b9f2b0c6fa', 'c1', 'p.1', 'Pronouns are words that replace nouns in a sentence.', 'Pronouns are words that replace nouns in a sentence.', '2026-10-08 05:32:01'),
(7, 6, '6ec9f5dbecd8ef6d9793a9ac23f183b9f2b0c6fa', 'c1', 'p.1', 'Nouns can be tangible or intangible.', 'Nouns can also be intangible or abstract.', '2026-10-08 05:32:01'),
(8, 6, '6ec9f5dbecd8ef6d9793a9ac23f183b9f2b0c6fa', 'c1', 'p.1', 'Plural nouns refer to more than one person, place or thing.', 'Plural nouns refer to more than one.', '2026-10-08 05:32:01'),
(9, 6, '6ec9f5dbecd8ef6d9793a9ac23f183b9f2b0c6fa', 'c2', 'p.2–p.4', 'Adjectives describe nouns.', 'Adjectives describe nouns. They tell us which, what kind, or how many of a certain noun there is.', '2026-10-08 05:32:01'),
(10, 6, '6ec9f5dbecd8ef6d9793a9ac23f183b9f2b0c6fa', 'c2', 'p.2–p.4', 'Adjectives can be introduced by a helping verb.', 'Adjectives can be introduced by a helping verb (like \"is\" for singular nouns or \"are\" for plural nouns) as in the first example, or placed in front of the noun they are modifying like in the second example.', '2026-10-08 05:32:01'),
(11, 6, '6ec9f5dbecd8ef6d9793a9ac23f183b9f2b0c6fa', 'c2', 'p.2–p.4', 'Subject pronouns replace the subjects of sentences.', 'Subject pronouns replace the subjects of sentences. Subjects of sentences perform action in sentences.', '2026-10-08 05:32:01'),
(12, 6, '6ec9f5dbecd8ef6d9793a9ac23f183b9f2b0c6fa', 'c2', 'p.2–p.4', 'Object pronouns replace the object in the sentence that is receiving action.', 'Object pronouns replace the object in the sentence that is receiving action.', '2026-10-08 05:32:01'),
(13, 6, '6ec9f5dbecd8ef6d9793a9ac23f183b9f2b0c6fa', 'c2', 'p.2–p.4', 'Verbs indicate action or state of being in sentences.', 'Verbs indicate action or state of being in sentences.', '2026-10-08 05:32:01'),
(14, 6, '6ec9f5dbecd8ef6d9793a9ac23f183b9f2b0c6fa', 'c2', 'p.2–p.4', 'Verbs can also be in different tenses.', 'Verbs can also be in different tenses.', '2026-10-08 05:32:01'),
(15, 6, '6ec9f5dbecd8ef6d9793a9ac23f183b9f2b0c6fa', 'c2', 'p.2–p.4', 'Verbs can be in multiple verb phrases including helping verbs.', 'Often there are multiple verbs in a sentence, or even entire verb phrases including helping verbs.', '2026-10-08 05:32:01'),
(16, 6, '6ec9f5dbecd8ef6d9793a9ac23f183b9f2b0c6fa', 'c2', 'p.2–p.4', 'Adverbs modify verbs.', 'Adverbs modify verbs. Adverbs describe how verbs, or actions, were done.', '2026-10-08 05:32:01'),
(17, 6, '6ec9f5dbecd8ef6d9793a9ac23f183b9f2b0c6fa', 'c2', 'p.2–p.4', 'Helping Verbs help to extend the meaning of verbs.', 'Helping Verbs, as the name suggests, help to extend the meaning of verbs already used in a sentence.', '2026-10-08 05:32:01'),
(18, 6, '6ec9f5dbecd8ef6d9793a9ac23f183b9f2b0c6fa', 'c2', 'p.2–p.4', 'Adverbs are used to help people better understand verb usage in a sentence.', 'Similar to helping verbs, adverbs are used to help people better understand verb usage in a sentence.', '2026-10-08 05:32:01');

-- --------------------------------------------------------

--
-- Table structure for table `quizgen_items`
--

CREATE TABLE `quizgen_items` (
  `id` int(11) NOT NULL,
  `run_id` int(11) NOT NULL,
  `teacher_id` int(11) NOT NULL,
  `kind` enum('question','activity') NOT NULL,
  `item_type` varchar(32) NOT NULL,
  `grade_band` char(1) NOT NULL,
  `cognitive_level` varchar(16) DEFAULT NULL,
  `payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`payload`)),
  `source_quote` text DEFAULT NULL,
  `chunk_id` varchar(16) DEFAULT NULL,
  `page_ref` varchar(64) DEFAULT NULL,
  `status` enum('draft','approved','rejected') NOT NULL DEFAULT 'draft',
  `validation` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`validation`)),
  `verifier` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`verifier`)),
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `quizgen_items`
--

INSERT INTO `quizgen_items` (`id`, `run_id`, `teacher_id`, `kind`, `item_type`, `grade_band`, `cognitive_level`, `payload`, `source_quote`, `chunk_id`, `page_ref`, `status`, `validation`, `verifier`, `sort_order`, `created_at`, `updated_at`) VALUES
(1, 1, 2, 'question', 'mcq', 'A', 'remember', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What are people, places, or things called?\",\"choices\":[\"Things\",\"People\",\"Nouns\"],\"correct_answer\":\"Nouns\",\"explanation\":\"The text says nouns are people, places, or things.\",\"source_quote\":\"Nouns are people, places or things.\",\"answer_index\":2,\"id\":\"q_5155ccc6\",\"grade_band\":\"A\",\"chunk_id\":\"c1\",\"page_ref\":\"p.1\",\"status\":\"draft\"}', 'Nouns are people, places or things.', 'c1', 'p.1', 'approved', '{\"ok\":true,\"metrics\":{\"quoteScore\":1,\"readability\":{\"grade\":4,\"avgWordLength\":4.71,\"words\":7,\"syllablesPerWord\":1.43}}}', '{\"pass\":true,\"model\":\"llama3.2:latest\",\"result\":{\"answer_from_quote\":\"Nouns\",\"answerable_from_quote_only\":true,\"exactly_one_choice_correct\":true,\"confidence\":1,\"notes\":\"These are called nouns.\"},\"reasons\":[]}', 0, '2026-10-08 05:42:24', '2026-10-08 05:51:40'),
(2, 1, 2, 'question', 'mcq', 'A', 'remember', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What do pronouns replace in a sentence?\",\"choices\":[\"Object\",\"Subject\",\"Noun\"],\"correct_answer\":\"Subject\",\"explanation\":\"The text says pronouns replace the subjects of sentences.\",\"source_quote\":\"Subject pronouns replace the subjects of sentences. Subjects of sentences perform action in sentences.\",\"answer_index\":1,\"id\":\"q_71f5579c\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\"}', 'Subject pronouns replace the subjects of sentences. Subjects of sentences perform action in sentences.', 'c2', 'p.2–p.4', 'approved', '{\"ok\":true,\"metrics\":{\"quoteScore\":1,\"readability\":{\"grade\":4,\"avgWordLength\":4.57,\"words\":7,\"syllablesPerWord\":1.43}}}', '{\"pass\":true,\"model\":\"llama3.2:latest\",\"result\":{\"answer_from_quote\":\"Subject pronouns replace the subjects of sentences.\",\"answerable_from_quote_only\":true,\"exactly_one_choice_correct\":true,\"confidence\":1,\"notes\":\"Pronouns replace the subject of a sentence.\"},\"reasons\":[]}', 1, '2026-10-08 05:42:24', '2026-10-08 05:51:43'),
(3, 1, 2, 'question', 'mcq', 'A', 'remember', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What do adverbs modify?\",\"choices\":[\"Verbs\",\"Adjectives\",\"Nouns\"],\"correct_answer\":\"Verbs\",\"explanation\":\"The text says adverbs modify verbs.\",\"source_quote\":\"Adverbs modify verbs. Adverbs describe how verbs, or actions, were done.\",\"answer_index\":0,\"id\":\"q_7720ff5b\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\"}', 'Adverbs modify verbs. Adverbs describe how verbs, or actions, were done.', 'c2', 'p.2–p.4', 'approved', '{\"ok\":true,\"metrics\":{\"quoteScore\":1,\"readability\":{\"grade\":6.6,\"avgWordLength\":4.75,\"words\":4,\"syllablesPerWord\":1.75}}}', '{\"pass\":true,\"model\":\"llama3.2:latest\",\"result\":{\"answer_from_quote\":\"Verbs\",\"answerable_from_quote_only\":true,\"exactly_one_choice_correct\":true,\"confidence\":1,\"notes\":\"Adverbs describe how verbs, or actions, were done.\"},\"reasons\":[]}', 2, '2026-10-08 05:42:24', '2026-10-08 05:51:45'),
(4, 1, 2, 'question', 'mcq', 'A', 'remember', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What are action words called?\",\"choices\":[\"Verbs\",\"Adjectives\",\"Nouns\"],\"correct_answer\":\"Verbs\",\"explanation\":\"The text says verbs are action words.\",\"source_quote\":\"Verbs are action words.\",\"answer_index\":0,\"id\":\"q_5958e8e1\",\"grade_band\":\"A\",\"chunk_id\":\"c1\",\"page_ref\":\"p.1\",\"status\":\"draft\"}', 'Verbs are action words.', 'c1', 'p.1', 'approved', '{\"ok\":true,\"metrics\":{\"quoteScore\":1,\"readability\":{\"grade\":2.9,\"avgWordLength\":4.8,\"words\":5,\"syllablesPerWord\":1.4}}}', '{\"pass\":true,\"model\":\"llama3.2:latest\",\"result\":{\"answer_from_quote\":\"Verbs are action words.\",\"answerable_from_quote_only\":true,\"exactly_one_choice_correct\":true,\"confidence\":1,\"notes\":\"Verbs are action words.\"},\"reasons\":[]}', 3, '2026-10-08 05:42:24', '2026-10-08 05:51:49'),
(5, 1, 2, 'question', 'mcq', 'A', 'understand', '{\"type\":\"mcq\",\"cognitive_level\":\"understand\",\"question_text\":\"What do adverbs help with?\",\"choices\":[\"Verb usage\",\"Sentence structure\",\"Verb meaning\"],\"correct_answer\":\"Verb usage\",\"explanation\":\"The text says adverbs help people better understand verb usage.\",\"source_quote\":\"Similar to helping verbs, adverbs are used to help people better understand verb usage in a sentence.\",\"answer_index\":0,\"id\":\"q_dc004a92\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\"}', 'Similar to helping verbs, adverbs are used to help people better understand verb usage in a sentence.', 'c2', 'p.2–p.4', 'approved', '{\"ok\":true,\"metrics\":{\"quoteScore\":1,\"readability\":{\"grade\":0.5,\"avgWordLength\":4.2,\"words\":5,\"syllablesPerWord\":1.2}}}', '{\"pass\":true,\"model\":\"llama3.2:latest\",\"result\":{\"answer_from_quote\":\"verb usage\",\"answerable_from_quote_only\":true,\"exactly_one_choice_correct\":true,\"confidence\":1,\"notes\":\"adverbs help with verb usage in a sentence\"},\"reasons\":[]}', 4, '2026-10-08 05:42:24', '2026-10-08 05:51:49'),
(6, 1, 2, 'question', 'mcq', 'A', 'remember', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What do verbs can be in?\",\"choices\":[\"Tenses\",\"Parts of speech\",\"Sentences\"],\"correct_answer\":\"Tenses\",\"explanation\":\"The text says verbs can also be in different tenses.\",\"source_quote\":\"Verbs can also be in different tenses.\",\"answer_index\":0,\"id\":\"q_57288926\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\"}', 'Verbs can also be in different tenses.', 'c2', 'p.2–p.4', 'approved', '{\"ok\":true,\"metrics\":{\"quoteScore\":1,\"readability\":{\"grade\":0,\"avgWordLength\":3,\"words\":6,\"syllablesPerWord\":1}}}', '{\"pass\":true,\"model\":\"llama3.2:latest\",\"result\":{\"answer_from_quote\":\"Tenses\",\"answerable_from_quote_only\":true,\"exactly_one_choice_correct\":true,\"confidence\":1,\"notes\":\"Verbs can be in different tenses.\"},\"reasons\":[]}', 5, '2026-10-08 05:42:24', '2026-10-08 05:51:49'),
(7, 1, 2, 'question', 'mcq', 'A', 'remember', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What introduces adjectives?\",\"choices\":[\"A helping verb\",\"A noun\",\"A verb\"],\"correct_answer\":\"A helping verb\",\"explanation\":\"The text says a helping verb introduces adjectives.\",\"source_quote\":\"Adjectives can be introduced by a helping verb (like \\\"is\\\" for singular nouns or \\\"are\\\" for plural nouns) as in the first example, or placed in front of the noun they are modifying like in the second example.\",\"answer_index\":0,\"id\":\"q_e1b792f8\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\"}', 'Adjectives can be introduced by a helping verb (like \"is\" for singular nouns or \"are\" for plural nouns) as in the first example, or placed in front of the noun they are modifying like in the second example.', 'c2', 'p.2–p.4', 'approved', '{\"ok\":true,\"metrics\":{\"quoteScore\":1,\"readability\":{\"grade\":21,\"avgWordLength\":8,\"words\":3,\"syllablesPerWord\":3}}}', '{\"pass\":true,\"model\":\"llama3.2:latest\",\"result\":{\"answer_from_quote\":\"A helping verb\",\"answerable_from_quote_only\":true,\"exactly_one_choice_correct\":true,\"confidence\":1,\"notes\":\"Helping verb introduces adjectives\"},\"reasons\":[]}', 6, '2026-10-08 05:42:24', '2026-10-08 05:51:49'),
(8, 1, 2, 'question', 'mcq', 'A', 'remember', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What are adjectives?\",\"choices\":[\"Descriptive words\",\"A type of noun\",\"A type of verb\"],\"correct_answer\":\"Descriptive words\",\"explanation\":\"The text says adjectives are descriptive words.\",\"source_quote\":\"Adjectives are descriptive words.\",\"answer_index\":0,\"id\":\"q_63b42058\",\"grade_band\":\"A\",\"chunk_id\":\"c1\",\"page_ref\":\"p.1\",\"status\":\"draft\"}', 'Adjectives are descriptive words.', 'c1', 'p.1', 'approved', '{\"ok\":true,\"metrics\":{\"quoteScore\":1,\"readability\":{\"grade\":9.2,\"avgWordLength\":5.67,\"words\":3,\"syllablesPerWord\":2}}}', '{\"pass\":true,\"model\":\"llama3.2:latest\",\"result\":{\"answer_from_quote\":\"Descriptive words.\",\"answerable_from_quote_only\":true,\"exactly_one_choice_correct\":true,\"confidence\":1,\"notes\":\"The quote directly answers the question.\"},\"reasons\":[]}', 7, '2026-10-08 05:42:24', '2026-10-08 05:51:49'),
(9, 1, 2, 'activity', 'matching', 'A', NULL, '{\"id\":\"a_4cdf4f13\",\"type\":\"matching\",\"grade_band\":\"A\",\"title\":\"Match the part of speech to its job\",\"instructions\":\"Match each part of speech to what it does.\",\"items\":[{\"prompt\":\"Noun\",\"answer\":\"a person, place, or thing\"},{\"prompt\":\"Verb\",\"answer\":\"helps to extend the meaning of verbs\"},{\"prompt\":\"Adverb\",\"answer\":\"describes how verbs, or actions, were done\"},{\"prompt\":\"Pronoun\",\"answer\":\"replaces nouns in a sentence\"}],\"word_bank\":[],\"answer_key\":[\"a person, place, or thing\",\"helps to extend the meaning of verbs\",\"describes how verbs, or actions, were done\",\"replaces nouns in a sentence\"],\"source_quotes\":[\"Verbs can also be in different tenses.\",\"A noun is a part of speech that signifies a person, place, or thing.\",\"Helping Verbs, as the name suggests, help to extend the meaning of verbs already used in a sentence.\",\"Adverbs modify verbs. Adverbs describe how verbs, or actions, were done.\",\"Nouns are people, places, or things.\",\"Similar to helping verbs, adverbs are used to help people better understand verb usage in a sentence.\",\"Pronouns are words that replace nouns in a sentence.\",\"Nouns can also be singular or plural.\"],\"chunk_ids\":[\"c2\",\"c1\"],\"page_refs\":[\"p.2–p.4\",\"p.1\"],\"status\":\"draft\"}', 'Verbs can also be in different tenses.\nA noun is a part of speech that signifies a person, place, or thing.\nHelping Verbs, as the name suggests, help to extend the meaning of verbs already used in a sentence.\nAdverbs modify verbs. Adverbs describe how verbs, or actions, were done.\nNouns are people, places, or things.\nSimilar to helping verbs, adverbs are used to help people better understand verb usage in a sentence.\nPronouns are words that replace nouns in a sentence.\nNouns can also be singular or plural.', 'c2', 'p.2–p.4, p.1', 'draft', '{\"ok\":true,\"metrics\":{\"quoteScores\":[1,1,1,1,1,1,1,1]}}', NULL, 8, '2026-10-08 05:42:24', '2026-10-08 05:42:24'),
(10, 3, 2, 'question', 'mcq', 'A', 'remember', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What do verbs do in a sentence?\",\"choices\":[\"Modify\",\"Help\",\"Act\"],\"correct_answer\":\"Act\",\"explanation\":\"The text says verbs are action words.\",\"source_quote\":\"Verbs are action words.\",\"answer_index\":2,\"id\":\"q_2fd69063\",\"grade_band\":\"A\",\"chunk_id\":\"c1\",\"page_ref\":\"p.1\",\"status\":\"draft\"}', 'Verbs are action words.', 'c1', 'p.1', 'draft', '{\"ok\":true,\"metrics\":{\"quoteScore\":1,\"readability\":{\"grade\":0.6,\"avgWordLength\":3.43,\"words\":7,\"syllablesPerWord\":1.14}}}', '{\"pass\":true,\"model\":\"llama3.2:latest\",\"result\":{\"answer_from_quote\":\"Act\",\"answerable_from_quote_only\":true,\"exactly_one_choice_correct\":true,\"confidence\":1,\"notes\":\"Verbs are action words.\"},\"reasons\":[]}', 0, '2026-10-08 10:04:47', '2026-10-08 10:04:47'),
(11, 3, 2, 'question', 'mcq', 'A', 'remember', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What can nouns be?\",\"choices\":[\"Only singular\",\"Only plural\",\"Singular or plural\"],\"correct_answer\":\"Singular or plural\",\"explanation\":\"The text says nouns can be singular or plural.\",\"source_quote\":\"Nouns can also be singular or plural.\",\"answer_index\":2,\"id\":\"q_7f1ac974\",\"grade_band\":\"A\",\"chunk_id\":\"c1\",\"page_ref\":\"p.1\",\"status\":\"draft\"}', 'Nouns can also be singular or plural.', 'c1', 'p.1', 'draft', '{\"ok\":true,\"metrics\":{\"quoteScore\":1,\"readability\":{\"grade\":0,\"avgWordLength\":3.5,\"words\":4,\"syllablesPerWord\":1}}}', '{\"pass\":true,\"model\":\"llama3.2:latest\",\"result\":{\"answer_from_quote\":\"Singular or plural\",\"answerable_from_quote_only\":true,\"exactly_one_choice_correct\":true,\"confidence\":1,\"notes\":\"Quote directly answers the question\"},\"reasons\":[]}', 1, '2026-10-08 10:04:47', '2026-10-08 10:04:47'),
(12, 3, 2, 'question', 'mcq', 'A', 'remember', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What do adjectives describe?\",\"choices\":[\"A verb\",\"A noun\",\"A sentence\"],\"correct_answer\":\"A noun\",\"explanation\":\"The text says adjectives describe nouns.\",\"source_quote\":\"Adjectives describe nouns. They tell us which, what kind, or how many of a certain noun there is.\",\"answer_index\":1,\"id\":\"q_8734c4d5\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\"}', 'Adjectives describe nouns. They tell us which, what kind, or how many of a certain noun there is.', 'c2', 'p.2–p.4', 'draft', '{\"ok\":true,\"metrics\":{\"quoteScore\":1,\"readability\":{\"grade\":9.6,\"avgWordLength\":6,\"words\":4,\"syllablesPerWord\":2}}}', '{\"pass\":true,\"model\":\"llama3.2:latest\",\"result\":{\"answer_from_quote\":\"A noun\",\"answerable_from_quote_only\":true,\"exactly_one_choice_correct\":true,\"confidence\":1,\"notes\":\"Adjectives describe nouns.\"},\"reasons\":[]}', 2, '2026-10-08 10:04:47', '2026-10-08 10:04:47'),
(13, 3, 2, 'activity', 'matching', 'A', NULL, '{\"id\":\"a_dfe8d447\",\"type\":\"matching\",\"grade_band\":\"A\",\"title\":\"Match the word type to its job\",\"instructions\":\"Match each word type to its job in the sentence.\",\"items\":[{\"prompt\":\"Adjective\",\"answer\":\"describe nouns\"},{\"prompt\":\"Adverb\",\"answer\":\"help understand verb usage\"},{\"prompt\":\"Pronoun\",\"answer\":\"replace nouns\"},{\"prompt\":\"Noun\",\"answer\":\"people, places, or things\"}],\"word_bank\":[],\"answer_key\":[\"describe nouns\",\"help understand verb usage\",\"replace nouns\",\"people, places, or things\"],\"source_quotes\":[\"Adverbs modify verbs. Adverbs describe how verbs, or actions, were done.\",\"Nouns are people, places, or things.\",\"Pronouns are words that replace nouns in a sentence.\",\"Adjectives describe nouns. They tell us which, what kind, or how many of a certain noun there is.\",\"Adjectives are descriptive words.\",\"Object pronouns replace the object in the sentence that is receiving action.\",\"Plural nouns refer to more than one.\",\"Similar to helping verbs, adverbs are used to help people better understand verb usage in a sentence.\"],\"chunk_ids\":[\"c2\",\"c1\"],\"page_refs\":[\"p.2–p.4\",\"p.1\"],\"status\":\"draft\"}', 'Adverbs modify verbs. Adverbs describe how verbs, or actions, were done.\nNouns are people, places, or things.\nPronouns are words that replace nouns in a sentence.\nAdjectives describe nouns. They tell us which, what kind, or how many of a certain noun there is.\nAdjectives are descriptive words.\nObject pronouns replace the object in the sentence that is receiving action.\nPlural nouns refer to more than one.\nSimilar to helping verbs, adverbs are used to help people better understand verb usage in a sentence.', 'c2', 'p.2–p.4, p.1', 'draft', '{\"ok\":true,\"metrics\":{\"quoteScores\":[1,1,1,1,1,1,1,1]}}', NULL, 3, '2026-10-08 10:04:47', '2026-10-08 10:04:47');

-- --------------------------------------------------------

--
-- Table structure for table `quizgen_rejections`
--

CREATE TABLE `quizgen_rejections` (
  `id` int(11) NOT NULL,
  `run_id` int(11) NOT NULL,
  `stage` varchar(16) NOT NULL,
  `reason` text NOT NULL,
  `item` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`item`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `quizgen_rejections`
--

INSERT INTO `quizgen_rejections` (`id`, `run_id`, `stage`, `reason`, `item`, `created_at`) VALUES
(1, 1, 'validate', 'MCQ_INDEX_MISMATCH: choices[answer_index] != correct_answer', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What replace nouns in a sentence?\",\"choices\":[\"People\",\"Things\",\"Pronouns\"],\"correct_answer\":\"Pronouns\",\"explanation\":\"The text says pronouns replace nouns.\",\"source_quote\":\"Pronouns are words that replace nouns in a sentence.\",\"answer_index\":1,\"id\":\"q_83a140a7\",\"grade_band\":\"A\",\"chunk_id\":\"c1\",\"page_ref\":\"p.1\",\"status\":\"draft\"}', '2026-10-08 05:42:24'),
(2, 1, 'verify', 'VERIFIER_DISAGREES: verifier said \"Adverbs modify verbs.\"', '{\"type\":\"true_false\",\"cognitive_level\":\"remember\",\"question_text\":\"Adverbs modify verbs.\",\"choices\":[\"True\",\"False\"],\"correct_answer\":\"True\",\"explanation\":\"The text says adverbs modify verbs.\",\"source_quote\":\"Adverbs modify verbs. Adverbs describe how verbs, or actions, were done.\",\"answer_index\":0,\"id\":\"q_f47aa5d5\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\",\"validation\":{\"ok\":true,\"metrics\":{\"quoteScore\":1,\"readability\":{\"grade\":9.2,\"avgWordLength\":6,\"words\":3,\"syllablesPerWord\":2}}},\"verifier\":{\"pass\":false,\"model\":\"llama3.2:latest\",\"result\":{\"answer_from_quote\":\"Adverbs modify verbs.\",\"answerable_from_quote_only\":true,\"exactly_one_choice_correct\":true,\"confidence\":1,\"notes\":\"Direct quote confirms answer\"},\"reasons\":[\"VERIFIER_DISAGREES: verifier said \\\"Adverbs modify verbs.\\\"\"]}}', '2026-10-08 05:42:24'),
(3, 1, 'validate', 'TYPE_NOT_REQUESTED: fill_blank_word_bank | READABILITY_TOO_HIGH: grade 6.7 > 3.5', '{\"type\":\"fill_blank_word_bank\",\"cognitive_level\":\"remember\",\"question_text\":\"Helping Verbs ______ verbs already used in a sentence.\",\"choices\":[\"extend\",\"add\",\"help\"],\"correct_answer\":\"extend\",\"explanation\":\"The text says helping verbs help to extend the meaning of verbs.\",\"source_quote\":\"Helping Verbs, as the name suggests, help to extend the meaning of verbs already used in a sentence.\",\"answer_index\":null,\"id\":\"q_9271e563\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\"}', '2026-10-08 05:42:24'),
(4, 1, 'validate', 'MCQ_INDEX_MISMATCH: choices[answer_index] != correct_answer', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What are action words called?\",\"choices\":[\"Actions\",\"Verbs\",\"Words\"],\"correct_answer\":\"Verbs\",\"explanation\":\"The text says verbs are action words.\",\"source_quote\":\"Verbs are action words.\",\"answer_index\":2,\"id\":\"q_6fea7d77\",\"grade_band\":\"A\",\"chunk_id\":\"c1\",\"page_ref\":\"p.1\",\"status\":\"draft\"}', '2026-10-08 05:42:24'),
(5, 1, 'validate', 'MCQ_DISTRACTOR_OFF_TOPIC: \"Animal\" | MCQ_DISTRACTOR_OFF_TOPIC: \"City\"', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What is a noun?\",\"choices\":[\"Animal\",\"City\",\"Thing\"],\"correct_answer\":\"Thing\",\"explanation\":\"The text says a noun is a thing.\",\"source_quote\":\"A noun is a part of speech that signifies a person, place, or thing.\",\"answer_index\":2,\"id\":\"q_72757bc3\",\"grade_band\":\"A\",\"chunk_id\":\"c1\",\"page_ref\":\"p.1\",\"status\":\"draft\"}', '2026-10-08 05:42:24'),
(6, 1, 'verify', 'VERIFIER_DISAGREES: verifier said \"Nouns can also be intangible or abstract.\"', '{\"type\":\"true_false\",\"cognitive_level\":\"remember\",\"question_text\":\"Nouns can only be tangible.\",\"choices\":[\"True\",\"False\"],\"correct_answer\":\"False\",\"explanation\":\"The text says nouns can also be intangible or abstract.\",\"source_quote\":\"Nouns can also be intangible or abstract.\",\"answer_index\":1,\"id\":\"q_02e6ecf7\",\"grade_band\":\"A\",\"chunk_id\":\"c1\",\"page_ref\":\"p.1\",\"status\":\"draft\",\"validation\":{\"ok\":true,\"metrics\":{\"quoteScore\":1,\"readability\":{\"grade\":5.2,\"avgWordLength\":4.4,\"words\":5,\"syllablesPerWord\":1.6}}},\"verifier\":{\"pass\":false,\"model\":\"llama3.2:latest\",\"result\":{\"answer_from_quote\":\"Nouns can also be intangible or abstract.\",\"answerable_from_quote_only\":true,\"exactly_one_choice_correct\":null,\"confidence\":1,\"notes\":\"Nouns can be abstract.\"},\"reasons\":[\"VERIFIER_DISAGREES: verifier said \\\"Nouns can also be intangible or abstract.\\\"\"]}}', '2026-10-08 05:42:24'),
(7, 1, 'validate', 'MCQ_DISTRACTOR_OFF_TOPIC: \"Animals\"', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What do adjectives describe?\",\"choices\":[\"Animals\",\"Places\",\"Nouns\"],\"correct_answer\":\"Nouns\",\"explanation\":\"The text says adjectives describe nouns.\",\"source_quote\":\"Adjectives describe nouns. They tell us which, what kind, or how many of a certain noun there is.\",\"answer_index\":2,\"id\":\"q_bf50bbe4\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\"}', '2026-10-08 05:42:24'),
(8, 1, 'validate', 'TYPE_NOT_REQUESTED: fill_blank_word_bank | WORD_BANK_MISSING_ANSWER', '{\"type\":\"fill_blank_word_bank\",\"cognitive_level\":\"understand\",\"question_text\":\"Adjectives are ______ words.\",\"choices\":[\"Big\",\"Small\",\"Many\"],\"correct_answer\":\"descriptive\",\"explanation\":\",\",\"source_quote\":\"Adjectives are descriptive words.\",\"answer_index\":null,\"id\":\"q_6cfe0c24\",\"grade_band\":\"A\",\"chunk_id\":\"c1\",\"page_ref\":\"p.1\",\"status\":\"draft\"}', '2026-10-08 05:42:24'),
(9, 1, 'verify', 'VERIFIER_MULTIPLE_CORRECT_CHOICES', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What do adverbs help with?\",\"choices\":[\"Verbs\",\"Adjectives\",\"Usage\"],\"correct_answer\":\"Usage\",\"explanation\":\"The text says adverbs help people better understand verb usage in a sentence.\",\"source_quote\":\"Similar to helping verbs, adverbs are used to help people better understand verb usage in a sentence.\",\"answer_index\":2,\"id\":\"q_7cdd7192\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\",\"validation\":{\"ok\":true,\"metrics\":{\"quoteScore\":1,\"readability\":{\"grade\":0.5,\"avgWordLength\":4.2,\"words\":5,\"syllablesPerWord\":1.2}}},\"verifier\":{\"pass\":false,\"model\":\"llama3.2:latest\",\"result\":{\"answer_from_quote\":\"help people better understand verb usage in a sentence.\",\"answerable_from_quote_only\":true,\"exactly_one_choice_correct\":false,\"confidence\":1,\"notes\":\"adverbs help with verb usage\"},\"reasons\":[\"VERIFIER_MULTIPLE_CORRECT_CHOICES\"]}}', '2026-10-08 05:42:24'),
(10, 1, 'verify', 'VERIFIER_NOT_ANSWERABLE_FROM_QUOTE | VERIFIER_CANNOT_ANSWER | VERIFIER_DISAGREES: verifier said \"CANNOT ANSWER\" | VERIFIER_LOW_CONFIDENCE: 0', '{\"type\":\"true_false\",\"cognitive_level\":\"remember\",\"question_text\":\"Pronouns are always nouns.\",\"choices\":[\"True\",\"False\"],\"correct_answer\":\"False\",\"explanation\":\"The text says pronouns are words that replace nouns.\",\"source_quote\":\"Pronouns are words that replace nouns in a sentence.\",\"answer_index\":1,\"id\":\"q_be9901e4\",\"grade_band\":\"A\",\"chunk_id\":\"c1\",\"page_ref\":\"p.1\",\"status\":\"draft\",\"validation\":{\"ok\":true,\"metrics\":{\"quoteScore\":1,\"readability\":{\"grade\":3.7,\"avgWordLength\":5.5,\"words\":4,\"syllablesPerWord\":1.5}}},\"verifier\":{\"pass\":false,\"model\":\"llama3.2:latest\",\"result\":{\"answer_from_quote\":\"CANNOT ANSWER\",\"answerable_from_quote_only\":false,\"exactly_one_choice_correct\":null,\"confidence\":0,\"notes\":\"Pronouns replace nouns, but not always.\"},\"reasons\":[\"VERIFIER_NOT_ANSWERABLE_FROM_QUOTE\",\"VERIFIER_CANNOT_ANSWER\",\"VERIFIER_DISAGREES: verifier said \\\"CANNOT ANSWER\\\"\",\"VERIFIER_LOW_CONFIDENCE: 0\"]}}', '2026-10-08 05:42:24'),
(11, 1, 'validate', 'TYPE_NOT_REQUESTED: fill_blank_word_bank | ANSWER_IN_QUESTION', '{\"type\":\"fill_blank_word_bank\",\"cognitive_level\":\"remember\",\"question_text\":\"Helping Verbs are used with __________ verbs.\",\"choices\":[\"Adjectives\",\"Verbs\",\"Nouns\"],\"correct_answer\":\"Verbs\",\"explanation\":\"The text says Helping Verbs help to extend the meaning of verbs.\",\"source_quote\":\"Helping Verbs, as the name suggests, help to extend the meaning of verbs already used in a sentence.\",\"answer_index\":null,\"id\":\"q_7ea86e72\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\"}', '2026-10-08 05:42:24'),
(12, 1, 'verify', 'VERIFIER_NOT_ANSWERABLE_FROM_QUOTE | VERIFIER_MULTIPLE_CORRECT_CHOICES', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What do adjectives describe?\",\"choices\":[\"Nouns\",\"Things\",\"People\"],\"correct_answer\":\"Nouns\",\"explanation\":\"The text says adjectives describe nouns.\",\"source_quote\":\"Adjectives describe nouns. They tell us which, what kind, or how many of a certain noun there is.\",\"answer_index\":0,\"id\":\"q_88a7008d\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\",\"validation\":{\"ok\":true,\"metrics\":{\"quoteScore\":1,\"readability\":{\"grade\":9.6,\"avgWordLength\":6,\"words\":4,\"syllablesPerWord\":2}}},\"verifier\":{\"pass\":false,\"model\":\"llama3.2:latest\",\"result\":{\"answer_from_quote\":\"Nouns\",\"answerable_from_quote_only\":false,\"exactly_one_choice_correct\":false,\"confidence\":1,\"notes\":\"Adjectives describe nouns.\"},\"reasons\":[\"VERIFIER_NOT_ANSWERABLE_FROM_QUOTE\",\"VERIFIER_MULTIPLE_CORRECT_CHOICES\"]}}', '2026-10-08 05:42:24'),
(13, 1, 'verify', 'VERIFIER_DISAGREES: verifier said \"Verbs can also be in different tenses.\"', '{\"type\":\"true_false\",\"cognitive_level\":\"remember\",\"question_text\":\"Verbs can only be in one tense.\",\"choices\":[\"True\",\"False\"],\"correct_answer\":\"False\",\"explanation\":\"The text says verbs can also be in different tenses.\",\"source_quote\":\"Verbs can also be in different tenses.\",\"answer_index\":1,\"id\":\"q_db8f8624\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\",\"validation\":{\"ok\":true,\"metrics\":{\"quoteScore\":1,\"readability\":{\"grade\":0.6,\"avgWordLength\":3.43,\"words\":7,\"syllablesPerWord\":1.14}}},\"verifier\":{\"pass\":false,\"model\":\"llama3.2:latest\",\"result\":{\"answer_from_quote\":\"Verbs can also be in different tenses.\",\"answerable_from_quote_only\":true,\"exactly_one_choice_correct\":null,\"confidence\":1,\"notes\":\"The quote directly answers the question.\"},\"reasons\":[\"VERIFIER_DISAGREES: verifier said \\\"Verbs can also be in different tenses.\\\"\"]}}', '2026-10-08 05:42:24'),
(14, 1, 'validate', 'ANSWER_NOT_IN_QUOTE: score=0.75', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What do object pronouns replace?\",\"choices\":[\"The subject\",\"The object\",\"The person receiving action\"],\"correct_answer\":\"The person receiving action\",\"explanation\":\"The text says object pronouns replace the object in the sentence that is receiving action.\",\"source_quote\":\"Object pronouns replace the object in the sentence that is receiving action.\",\"answer_index\":2,\"id\":\"q_d1ae26c0\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\"}', '2026-10-08 05:42:24'),
(15, 1, 'validate', 'NEAR_DUPLICATE: of q_71f5579c (1.00)', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What do pronouns replace in a sentence?\",\"choices\":[\"Nouns\",\"Things\",\"People\"],\"correct_answer\":\"Nouns\",\"explanation\":\"The text says pronouns replace nouns.\",\"source_quote\":\"Pronouns are words that replace nouns in a sentence.\",\"answer_index\":0,\"id\":\"q_fa4b8a08\",\"grade_band\":\"A\",\"chunk_id\":\"c1\",\"page_ref\":\"p.1\",\"status\":\"draft\"}', '2026-10-08 05:42:24'),
(16, 1, 'verify', 'VERIFIER_DISAGREES: verifier said \"helping verbs help to extend the meaning of verbs already used in a sentence.\"', '{\"type\":\"true_false\",\"cognitive_level\":\"remember\",\"question_text\":\"Helping Verbs help to extend the meaning of verbs.\",\"choices\":[\"True\",\"False\"],\"correct_answer\":\"True\",\"explanation\":\"The text states this directly.\",\"source_quote\":\"Helping Verbs, as the name suggests, help to extend the meaning of verbs already used in a sentence.\",\"answer_index\":0,\"id\":\"q_27492895\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\",\"validation\":{\"ok\":true,\"metrics\":{\"quoteScore\":1,\"readability\":{\"grade\":3.7,\"avgWordLength\":4.56,\"words\":9,\"syllablesPerWord\":1.33}}},\"verifier\":{\"pass\":false,\"model\":\"llama3.2:latest\",\"result\":{\"answer_from_quote\":\"helping verbs help to extend the meaning of verbs already used in a sentence.\",\"answerable_from_quote_only\":true,\"exactly_one_choice_correct\":null,\"confidence\":1,\"notes\":\"The quote explicitly states the function of helping verbs.\"},\"reasons\":[\"VERIFIER_DISAGREES: verifier said \\\"helping verbs help to extend the meaning of verbs already used in a sentence.\\\"\"]}}', '2026-10-08 05:42:24'),
(17, 1, 'validate', 'TYPE_NOT_REQUESTED: fill_blank_word_bank | WORD_BANK_TOO_SMALL | QUESTION_TOO_LONG: 16 > 12 words | READABILITY_TOO_HIGH: grade 9.8 > 3.5', '{\"type\":\"fill_blank_word_bank\",\"cognitive_level\":\"understand\",\"question_text\":\"Adjectives can be introduced by a helping verb (like ____ for singular nouns or ____ for plural nouns).\",\"choices\":[\"is\",\"are\"],\"correct_answer\":\"is\",\"explanation\":\"The text mentions this example.\",\"source_quote\":\"Adjectives can be introduced by a helping verb (like \\\"is\\\" for singular nouns or \\\"are\\\" for plural nouns) as in the first example, or placed in front of the noun they are modifying like in the second example.\",\"answer_index\":null,\"id\":\"q_7bea2344\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\"}', '2026-10-08 05:42:24'),
(18, 1, 'validate', 'ANSWER_NOT_IN_QUOTE: score=0.20', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What can nouns be?\",\"choices\":[\"Singular\",\"Plural\",\"Both\"],\"correct_answer\":\"Both\",\"explanation\":\"The text states this directly.\",\"source_quote\":\"Nouns can also be singular or plural.\",\"answer_index\":2,\"id\":\"q_cc5d5c02\",\"grade_band\":\"A\",\"chunk_id\":\"c1\",\"page_ref\":\"p.1\",\"status\":\"draft\"}', '2026-10-08 05:42:24'),
(19, 1, 'validate', 'ANSWER_NOT_IN_QUOTE: score=0.83 | MCQ_CHOICE_COUNT: expected 3, got 6 | MCQ_DUPLICATE_CHOICES', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What do nouns signify?\",\"choices\":[\"Things\",\"People\",\"Places\",\"Things\",\"People\",\"Places\"],\"correct_answer\":\"Things\",\"explanation\":\"The text states this directly.\",\"source_quote\":\"A noun is a part of speech that signifies a person, place, or thing.\",\"answer_index\":0,\"id\":\"q_55c7924d\",\"grade_band\":\"A\",\"chunk_id\":\"c1\",\"page_ref\":\"p.1\",\"status\":\"draft\"}', '2026-10-08 05:42:24'),
(20, 1, 'validate', 'READABILITY_TOO_HIGH: grade 6.4 > 3.5', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What do verbs indicate in sentences?\",\"choices\":[\"Action\",\"State\",\"Thing\"],\"correct_answer\":\"State\",\"explanation\":\"The text says verbs indicate action or state of being.\",\"source_quote\":\"Verbs indicate action or state of being in sentences.\",\"answer_index\":1,\"id\":\"q_242bfd19\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\"}', '2026-10-08 05:42:24'),
(21, 1, 'validate', 'WORDS_TOO_LONG: avg 7 > 5.2', '{\"type\":\"true_false\",\"cognitive_level\":\"remember\",\"question_text\":\"Adjectives are always descriptive words.\",\"choices\":[\"True\",\"False\"],\"correct_answer\":\"False\",\"explanation\":\"The text says adjectives are descriptive words.\",\"source_quote\":\"Adjectives are descriptive words.\",\"answer_index\":1,\"id\":\"q_e7abd61c\",\"grade_band\":\"A\",\"chunk_id\":\"c1\",\"page_ref\":\"p.1\",\"status\":\"draft\"}', '2026-10-08 05:42:24'),
(22, 1, 'validate', 'TYPE_NOT_REQUESTED: fill_blank_word_bank', '{\"type\":\"fill_blank_word_bank\",\"cognitive_level\":\"remember\",\"question_text\":\"Plural nouns refer to ____ person, place or thing.\",\"choices\":[\"one\",\"more\",\"many\"],\"correct_answer\":\"more\",\"explanation\":\"The text says plural nouns refer to more than one.\",\"source_quote\":\"Plural nouns refer to more than one.\",\"answer_index\":null,\"id\":\"q_6b91cf68\",\"grade_band\":\"A\",\"chunk_id\":\"c1\",\"page_ref\":\"p.1\",\"status\":\"draft\"}', '2026-10-08 05:42:24'),
(23, 1, 'verify', 'VERIFIER_DISAGREES: verifier said \"Nouns can also be singular or plural.\"', '{\"type\":\"true_false\",\"cognitive_level\":\"remember\",\"question_text\":\"Nouns can be singular or plural.\",\"choices\":[\"True\",\"False\"],\"correct_answer\":\"True\",\"explanation\":\"The text says nouns can be singular or plural.\",\"source_quote\":\"Nouns can also be singular or plural.\",\"answer_index\":0,\"id\":\"q_240ba428\",\"grade_band\":\"A\",\"chunk_id\":\"c1\",\"page_ref\":\"p.1\",\"status\":\"draft\",\"validation\":{\"ok\":true,\"metrics\":{\"quoteScore\":1,\"readability\":{\"grade\":4.5,\"avgWordLength\":4.33,\"words\":6,\"syllablesPerWord\":1.5}}},\"verifier\":{\"pass\":false,\"model\":\"llama3.2:latest\",\"result\":{\"answer_from_quote\":\"Nouns can also be singular or plural.\",\"answerable_from_quote_only\":true,\"exactly_one_choice_correct\":null,\"confidence\":1,\"notes\":\"The quote directly answers the question.\"},\"reasons\":[\"VERIFIER_DISAGREES: verifier said \\\"Nouns can also be singular or plural.\\\"\"]}}', '2026-10-08 05:42:24'),
(24, 1, 'validate', 'ANSWER_NOT_IN_QUOTE: score=0.76 | MCQ_CORRECT_TOO_LONG | CHOICE_TOO_LONG: > 6 words', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What do verbs do in sentences?\",\"choices\":[\"Tell us who\",\"Tell us what\",\"Tell us action or state of being\"],\"correct_answer\":\"Tell us action or state of being\",\"explanation\":\"The text says verbs indicate action or state of being in sentences.\",\"source_quote\":\"Verbs indicate action or state of being in sentences.\",\"answer_index\":2,\"id\":\"q_36ad0629\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\"}', '2026-10-08 05:42:24'),
(25, 3, 'validate', 'MCQ_INDEX_MISMATCH: choices[answer_index] != correct_answer | READABILITY_TOO_HIGH: grade 5.2 > 3.5 | ANSWER_IN_QUESTION', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What do object pronouns replace in a sentence?\",\"choices\":[\"Nouns\",\"People\",\"Things\"],\"correct_answer\":\"Object\",\"explanation\":\"The text says object pronouns replace the object.\",\"source_quote\":\"Object pronouns replace the object in the sentence that is receiving action.\",\"answer_index\":1,\"id\":\"q_e08798cd\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\"}', '2026-10-08 10:04:47'),
(26, 3, 'validate', 'MCQ_INDEX_MISMATCH: choices[answer_index] != correct_answer | ANSWER_IN_QUESTION', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What are pronouns in a sentence?\",\"choices\":[\"Nouns\",\"Verbs\",\"Adjectives\"],\"correct_answer\":\"Pronouns\",\"explanation\":\"The text says pronouns replace nouns.\",\"source_quote\":\"Pronouns are words that replace nouns in a sentence.\",\"answer_index\":1,\"id\":\"q_9685faa9\",\"grade_band\":\"A\",\"chunk_id\":\"c1\",\"page_ref\":\"p.1\",\"status\":\"draft\"}', '2026-10-08 10:04:47'),
(27, 3, 'validate', 'READABILITY_TOO_HIGH: grade 5.7 > 3.5', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What do adverbs modify in a sentence?\",\"choices\":[\"Verbs\",\"Adjectives\",\"Nouns\"],\"correct_answer\":\"Verbs\",\"explanation\":\"The text says adverbs modify verbs.\",\"source_quote\":\"Adverbs modify verbs. Adverbs describe how verbs, or actions, were done.\",\"answer_index\":0,\"id\":\"q_cd5e5668\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\"}', '2026-10-08 10:04:47'),
(28, 3, 'validate', 'MCQ_CHOICE_COUNT: expected 3, got 5 | MCQ_INDEX_MISMATCH: choices[answer_index] != correct_answer | ANSWER_IN_QUESTION', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What are nouns in a sentence?\",\"choices\":[\"People\",\"Places\",\"Things\",\"Plural\",\"Singular\"],\"correct_answer\":\"Nouns\",\"explanation\":\"The text says nouns are people, places, or things.\",\"source_quote\":\"Nouns are people, places or things.\",\"answer_index\":0,\"id\":\"q_3948ebff\",\"grade_band\":\"A\",\"chunk_id\":\"c1\",\"page_ref\":\"p.1\",\"status\":\"draft\"}', '2026-10-08 10:04:47'),
(29, 3, 'validate', 'MCQ_CHOICE_COUNT: expected 3, got 4 | ANSWER_IN_QUESTION', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What do helping verbs help with?\",\"choices\":[\"Verbs\",\"Adjectives\",\"Nouns\",\"Pronouns\"],\"correct_answer\":\"Verbs\",\"explanation\":\"The text says helping verbs help to extend the meaning of verbs.\",\"source_quote\":\"Helping Verbs, as the name suggests, help to extend the meaning of verbs already used in a sentence.\",\"answer_index\":0,\"id\":\"q_b968357c\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\"}', '2026-10-08 10:04:47'),
(30, 3, 'verify', 'VERIFIER_PICKED_DISTRACTOR: \"People\" | VERIFIER_DISAGREES: verifier said \"People\"', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What do helping verbs help?\",\"choices\":[\"People\",\"Things\",\"Sentences\"],\"correct_answer\":\"Sentences\",\"explanation\":\"The text says helping verbs help verb usage.\",\"source_quote\":\"Similar to helping verbs, adverbs are used to help people better understand verb usage in a sentence.\",\"answer_index\":2,\"id\":\"q_37927f56\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\",\"validation\":{\"ok\":true,\"metrics\":{\"quoteScore\":1,\"readability\":{\"grade\":0.5,\"avgWordLength\":4.4,\"words\":5,\"syllablesPerWord\":1.2}}},\"verifier\":{\"pass\":false,\"model\":\"llama3.2:latest\",\"result\":{\"answer_from_quote\":\"People\",\"answerable_from_quote_only\":true,\"exactly_one_choice_correct\":true,\"confidence\":1,\"notes\":\"Adverbs help verb usage in a sentence.\"},\"reasons\":[\"VERIFIER_PICKED_DISTRACTOR: \\\"People\\\"\",\"VERIFIER_DISAGREES: verifier said \\\"People\\\"\"]}}', '2026-10-08 10:04:47'),
(31, 3, 'validate', 'MCQ_CHOICE_COUNT: expected 3, got 4 | MCQ_INDEX_MISMATCH: choices[answer_index] != correct_answer | MCQ_DISTRACTOR_OFF_TOPIC: \"Objects\"', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What do pronouns replace in a sentence?\",\"choices\":[\"Objects\",\"Subjects\",\"Nouns\",\"Verbs\"],\"correct_answer\":\"Nouns\",\"explanation\":\"The text says pronouns replace nouns in a sentence.\",\"source_quote\":\"Pronouns are words that replace nouns in a sentence.\",\"answer_index\":1,\"id\":\"q_db5fba5e\",\"grade_band\":\"A\",\"chunk_id\":\"c1\",\"page_ref\":\"p.1\",\"status\":\"draft\"}', '2026-10-08 10:04:47'),
(32, 3, 'validate', 'MCQ_CHOICE_COUNT: expected 3, got 4 | MCQ_INDEX_MISMATCH: choices[answer_index] != correct_answer | MCQ_DISTRACTOR_OFF_TOPIC: \"Objects\"', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What do object pronouns replace?\",\"choices\":[\"Objects\",\"Subjects\",\"Nouns\",\"Verbs\"],\"correct_answer\":\"Objects\",\"explanation\":\"The text says object pronouns replace the object in the sentence that is receiving action.\",\"source_quote\":\"Object pronouns replace the object in the sentence that is receiving action.\",\"answer_index\":1,\"id\":\"q_37f2aa8f\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\"}', '2026-10-08 10:04:47'),
(33, 3, 'validate', 'MCQ_CHOICE_COUNT: expected 3, got 4 | MCQ_DISTRACTOR_OFF_TOPIC: \"Objects\"', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What do adverbs modify?\",\"choices\":[\"Verbs\",\"Nouns\",\"Adjectives\",\"Objects\"],\"correct_answer\":\"Verbs\",\"explanation\":\"The text says adverbs modify verbs.\",\"source_quote\":\"Adverbs modify verbs. Adverbs describe how verbs, or actions, were done.\",\"answer_index\":0,\"id\":\"q_323b8c4e\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\"}', '2026-10-08 10:04:47'),
(34, 3, 'validate', 'MCQ_CHOICE_COUNT: expected 3, got 4', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What are nouns?\",\"choices\":[\"People\",\"Places\",\"Things\",\"Verbs\"],\"correct_answer\":\"Things\",\"explanation\":\"The text says nouns are people, places, or things.\",\"source_quote\":\"Nouns are people, places, or things.\",\"answer_index\":2,\"id\":\"q_f90e1812\",\"grade_band\":\"A\",\"chunk_id\":\"c1\",\"page_ref\":\"p.1\",\"status\":\"draft\"}', '2026-10-08 10:04:47'),
(35, 3, 'validate', 'ANSWER_NOT_IN_QUOTE: score=0.20 | MCQ_CHOICE_COUNT: expected 3, got 4 | MCQ_ALL_NONE_OF_ABOVE | MCQ_DISTRACTOR_OFF_TOPIC: \"All of the above\"', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What can nouns be?\",\"choices\":[\"Person\",\"Place\",\"Thing\",\"All of the above\"],\"correct_answer\":\"Thing\",\"explanation\":\"The text says nouns can be singular or plural.\",\"source_quote\":\"Nouns can also be singular or plural.\",\"answer_index\":2,\"id\":\"q_301ae532\",\"grade_band\":\"A\",\"chunk_id\":\"c1\",\"page_ref\":\"p.1\",\"status\":\"draft\"}', '2026-10-08 10:04:47'),
(36, 3, 'validate', 'TYPE_NOT_REQUESTED: true_false', '{\"type\":\"true_false\",\"cognitive_level\":\"remember\",\"question_text\":\"Nouns can be only tangible.\",\"choices\":[\"True\",\"False\"],\"correct_answer\":\"False\",\"explanation\":\"The text says nouns can be intangible or abstract.\",\"source_quote\":\"Nouns can also be intangible or abstract.\",\"answer_index\":1,\"id\":\"q_23eff476\",\"grade_band\":\"A\",\"chunk_id\":\"c1\",\"page_ref\":\"p.1\",\"status\":\"draft\"}', '2026-10-08 10:04:47'),
(37, 3, 'validate', 'MCQ_CHOICE_COUNT: expected 3, got 4', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What do adjectives describe?\",\"choices\":[\"Verbs\",\"Adverbs\",\"Nouns\",\"Things\"],\"correct_answer\":\"Nouns\",\"explanation\":\"The text says adjectives describe nouns.\",\"source_quote\":\"Adjectives describe nouns. They tell us which, what kind, or how many of a certain noun there is.\",\"answer_index\":2,\"id\":\"q_2cf988af\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\"}', '2026-10-08 10:04:47'),
(38, 3, 'validate', 'ANSWER_NOT_IN_QUOTE: score=0.20 | MCQ_CHOICE_COUNT: expected 3, got 4 | READABILITY_TOO_HIGH: grade 6.4 > 3.5', '{\"type\":\"mcq\",\"cognitive_level\":\"understand\",\"question_text\":\"What do verbs indicate in sentences?\",\"choices\":[\"Action\",\"State of being\",\"Both\",\"Things\"],\"correct_answer\":\"Both\",\"explanation\":\"The text says verbs indicate action or state of being in sentences.\",\"source_quote\":\"Verbs indicate action or state of being in sentences.\",\"answer_index\":2,\"id\":\"q_2fc0bbc9\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\"}', '2026-10-08 10:04:47'),
(39, 3, 'validate', 'MCQ_CHOICE_COUNT: expected 3, got 4 | READABILITY_TOO_HIGH: grade 6.4 > 3.5', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What help people understand verb usage?\",\"choices\":[\"Verbs\",\"Adjectives\",\"Nouns\",\"Adverbs\"],\"correct_answer\":\"Adverbs\",\"explanation\":\"The text says adverbs are used to help people better understand verb usage in a sentence.\",\"source_quote\":\"Similar to helping verbs, adverbs are used to help people better understand verb usage in a sentence.\",\"answer_index\":3,\"id\":\"q_cc3b63ee\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\"}', '2026-10-08 10:04:47'),
(40, 3, 'validate', 'MCQ_CHOICE_COUNT: expected 3, got 4 | MCQ_DISTRACTOR_OFF_TOPIC: \"Few\" | MCQ_IMPLAUSIBLE_DISTRACTOR: \"None\"', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What do plural nouns refer to?\",\"choices\":[\"One\",\"More than one\",\"Few\",\"None\"],\"correct_answer\":\"More than one\",\"explanation\":\"The text says plural nouns refer to more than one.\",\"source_quote\":\"Plural nouns refer to more than one.\",\"answer_index\":1,\"id\":\"q_0a27e847\",\"grade_band\":\"A\",\"chunk_id\":\"c1\",\"page_ref\":\"p.1\",\"status\":\"draft\"}', '2026-10-08 10:04:47'),
(41, 3, 'validate', 'TYPE_NOT_REQUESTED: true_false', '{\"type\":\"true_false\",\"cognitive_level\":\"remember\",\"question_text\":\"Verbs can only be in one tense.\",\"choices\":[\"True\",\"False\"],\"correct_answer\":\"False\",\"explanation\":\"The text says verbs can also be in different tenses.\",\"source_quote\":\"Verbs can also be in different tenses.\",\"answer_index\":1,\"id\":\"q_976d623d\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\"}', '2026-10-08 10:04:47'),
(42, 3, 'validate', 'MCQ_CHOICE_COUNT: expected 3, got 4 | MCQ_INDEX_MISMATCH: choices[answer_index] != correct_answer | ANSWER_IN_QUESTION', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What do subject pronouns replace?\",\"choices\":[\"Object\",\"Action\",\"Subject\",\"Thing\"],\"correct_answer\":\"Subject\",\"explanation\":\"The text says subject pronouns replace the subjects of sentences.\",\"source_quote\":\"Subject pronouns replace the subjects of sentences. Subjects of sentences perform action in sentences.\",\"answer_index\":1,\"id\":\"q_6582019f\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\"}', '2026-10-08 10:04:47'),
(43, 3, 'validate', 'TYPE_NOT_REQUESTED: fill_blank_word_bank', '{\"type\":\"fill_blank_word_bank\",\"cognitive_level\":\"remember\",\"question_text\":\"Pronouns are words that replace _______ in a sentence.\",\"choices\":[\"Nouns\",\"Verbs\",\"Adjectives\",\"Things\"],\"correct_answer\":\"Nouns\",\"explanation\":\"The text says pronouns are words that replace nouns in a sentence.\",\"source_quote\":\"Pronouns are words that replace nouns in a sentence.\",\"answer_index\":null,\"id\":\"q_9446290f\",\"grade_band\":\"A\",\"chunk_id\":\"c1\",\"page_ref\":\"p.1\",\"status\":\"draft\"}', '2026-10-08 10:04:47'),
(44, 3, 'validate', 'MCQ_CHOICE_COUNT: expected 3, got 4', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What do adverbs modify?\",\"choices\":[\"Nouns\",\"Verbs\",\"Adjectives\",\"Things\"],\"correct_answer\":\"Verbs\",\"explanation\":\"The text says adverbs modify verbs.\",\"source_quote\":\"Adverbs modify verbs. Adverbs describe how verbs, or actions, were done.\",\"answer_index\":1,\"id\":\"q_85c58b2b\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\"}', '2026-10-08 10:04:47'),
(45, 3, 'validate', 'WORDS_TOO_LONG: avg 7 > 5.2', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What introduces adjectives in sentences?\",\"choices\":[\"A verb\",\"A noun\",\"A helping verb\"],\"correct_answer\":\"A helping verb\",\"explanation\":\"The text says helping verbs introduce adjectives.\",\"source_quote\":\"Adjectives can be introduced by a helping verb (like “is’ for singular nouns or “are’ for plural nouns) as in the first example, or placed in front of the noun they are modifying like in the second example.\",\"answer_index\":2,\"id\":\"q_9666c181\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\"}', '2026-10-08 10:04:47'),
(46, 3, 'validate', 'ANSWER_NOT_IN_QUOTE: score=0.50 | MCQ_CHOICE_COUNT: expected 3, got 4', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What is a helping verb in sentences?\",\"choices\":[\"A verb that helps\",\"A verb that hurts\",\"A verb that helps the sentence\",\"A verb that hurts the sentence\"],\"correct_answer\":\"A verb that helps\",\"explanation\":\"The text says helping verbs are part of verb phrases.\",\"source_quote\":\"Often there are multiple verbs in a sentence, or even entire verb phrases including helping verbs.\",\"answer_index\":0,\"id\":\"q_93633abc\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\"}', '2026-10-08 10:04:47'),
(47, 3, 'validate', 'MCQ_CHOICE_COUNT: expected 3, got 4 | MCQ_CORRECT_TOO_LONG', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What is a noun in sentences?\",\"choices\":[\"A person\",\"A place\",\"A thing\",\"A person, place, or thing\"],\"correct_answer\":\"A person, place, or thing\",\"explanation\":\"The text defines a noun.\",\"source_quote\":\"A noun is a part of speech that signifies a person, place, or thing.\",\"answer_index\":3,\"id\":\"q_c25f0a4b\",\"grade_band\":\"A\",\"chunk_id\":\"c1\",\"page_ref\":\"p.1\",\"status\":\"draft\"}', '2026-10-08 10:04:47'),
(48, 3, 'validate', 'MCQ_DISTRACTOR_OFF_TOPIC: \"Act\"', '{\"type\":\"mcq\",\"cognitive_level\":\"remember\",\"question_text\":\"What do verbs do in sentences?\",\"choices\":[\"Modify\",\"Help\",\"Act\"],\"correct_answer\":\"Help\",\"explanation\":\"The text says helping verbs help to extend the meaning of verbs.\",\"source_quote\":\"Helping Verbs, as the name suggests, help to extend the meaning of verbs already used in a sentence.\",\"answer_index\":1,\"id\":\"q_9e414af7\",\"grade_band\":\"A\",\"chunk_id\":\"c2\",\"page_ref\":\"p.2–p.4\",\"status\":\"draft\"}', '2026-10-08 10:04:47'),
(49, 3, 'validate', 'ACT_ANSWER_NOT_IN_QUOTE: \"action or state\" (0.67) | ACT_ANSWER_NOT_IN_QUOTE: \"describe how an action is done\" (0.83)', '{\"id\":\"a_42116018\",\"type\":\"matching\",\"grade_band\":\"A\",\"title\":\"Match the part of speech to its job\",\"instructions\":\"Match each part of speech to what it does.\",\"items\":[{\"prompt\":\"Noun\",\"answer\":\"person, place, or thing\"},{\"prompt\":\"Verb\",\"answer\":\"action or state\"},{\"prompt\":\"Adverb\",\"answer\":\"describe how an action is done\"},{\"prompt\":\"Pronoun\",\"answer\":\"replace a noun in a sentence\"}],\"word_bank\":[],\"answer_key\":[\"person, place, or thing\",\"action or state\",\"describe how an action is done\",\"replace a noun in a sentence\"],\"source_quotes\":[\"Verbs can also be in different tenses.\",\"A noun is a part of speech that signifies a person, place, or thing.\",\"Nouns can also be singular or plural.\",\"Adverbs modify verbs. Adverbs describe how verbs, or actions, were done.\",\"Nouns are people, places, or things.\",\"Similar to helping verbs, adverbs are used to help people better understand verb usage in a sentence.\",\"Pronouns are words that replace nouns in a sentence.\",\"Helping Verbs, as the name suggests, help to extend the meaning of verbs already used in a sentence.\"],\"chunk_ids\":[\"c2\",\"c1\"],\"page_refs\":[\"p.2–p.4\",\"p.1\"],\"status\":\"draft\"}', '2026-10-08 10:04:47');

-- --------------------------------------------------------

--
-- Table structure for table `quizgen_runs`
--

CREATE TABLE `quizgen_runs` (
  `id` int(11) NOT NULL,
  `lesson_plan_id` int(11) NOT NULL,
  `teacher_id` int(11) NOT NULL,
  `subject_id` int(11) DEFAULT NULL,
  `grade_level` tinyint(4) NOT NULL,
  `grade_band` char(1) NOT NULL,
  `language` varchar(16) NOT NULL DEFAULT 'en',
  `difficulty` varchar(16) NOT NULL DEFAULT 'medium',
  `request` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`request`)),
  `status` enum('queued','processing','ready','failed') NOT NULL DEFAULT 'queued',
  `progress` tinyint(4) NOT NULL DEFAULT 0,
  `progress_message` varchar(255) DEFAULT NULL,
  `stats` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`stats`)),
  `error` text DEFAULT NULL,
  `model` varchar(100) DEFAULT NULL,
  `verifier_model` varchar(100) DEFAULT NULL,
  `prompt_version` varchar(16) DEFAULT NULL,
  `quiz_set_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `quizgen_runs`
--

INSERT INTO `quizgen_runs` (`id`, `lesson_plan_id`, `teacher_id`, `subject_id`, `grade_level`, `grade_band`, `language`, `difficulty`, `request`, `status`, `progress`, `progress_message`, `stats`, `error`, `model`, `verifier_model`, `prompt_version`, `quiz_set_id`, `created_at`, `updated_at`) VALUES
(1, 6, 2, 16, 1, 'A', 'en', 'medium', '{\"grade\":1,\"band\":\"A\",\"count\":10,\"question_types\":[\"mcq\",\"true_false\"],\"activity_types\":[\"matching\"],\"language\":\"en\",\"difficulty\":\"medium\",\"subject\":\"English\"}', 'ready', 100, 'Ready for review', '{\"requested\":10,\"questions_accepted\":8,\"activities_requested\":1,\"activities_accepted\":1,\"facts\":18,\"facts_from_cache\":false,\"chunks\":2,\"words\":922,\"llm_attempts\":{\"questions\":7,\"activities\":1},\"rejections\":24,\"rejections_by_stage\":{\"validate\":16,\"verify\":8},\"rejections_by_reason\":{\"MCQ_INDEX_MISMATCH\":2,\"VERIFIER_DISAGREES\":5,\"TYPE_NOT_REQUESTED\":5,\"MCQ_DISTRACTOR_OFF_TOPIC\":2,\"VERIFIER_MULTIPLE_CORRECT_CHOICES\":1,\"VERIFIER_NOT_ANSWERABLE_FROM_QUOTE\":2,\"ANSWER_NOT_IN_QUOTE\":4,\"NEAR_DUPLICATE\":1,\"READABILITY_TOO_HIGH\":1,\"WORDS_TOO_LONG\":1},\"duration_ms\":745914,\"model\":\"llama3.2:latest\",\"verifier_model\":\"llama3.2:latest\",\"prompt_version\":\"v1\"}', NULL, 'llama3.2:latest', 'llama3.2:latest', 'v1', 8, '2026-10-08 05:29:58', '2026-10-08 05:52:01'),
(2, 6, 2, 16, 1, 'A', 'en', 'medium', '{\"grade\":1,\"band\":\"A\",\"count\":10,\"question_types\":[\"mcq\"],\"activity_types\":[],\"language\":\"en\",\"difficulty\":\"medium\",\"subject\":\"English\"}', 'failed', 45, 'Writing questions (1/10)', NULL, 'The server restarted while this job was running. Please generate again.', 'llama3.2:latest', 'llama3.2:latest', 'v1', NULL, '2026-10-08 09:35:58', '2026-10-08 09:44:36'),
(3, 6, 2, 16, 1, 'A', 'en', 'medium', '{\"grade\":1,\"band\":\"A\",\"count\":10,\"question_types\":[\"mcq\"],\"activity_types\":[\"matching\"],\"language\":\"en\",\"difficulty\":\"medium\",\"subject\":\"English\"}', 'ready', 100, 'Ready for review', '{\"requested\":10,\"questions_accepted\":3,\"activities_requested\":1,\"activities_accepted\":1,\"facts\":18,\"facts_from_cache\":true,\"chunks\":2,\"words\":922,\"llm_attempts\":{\"questions\":7,\"activities\":2},\"rejections\":25,\"rejections_by_stage\":{\"validate\":24,\"verify\":1},\"rejections_by_reason\":{\"MCQ_INDEX_MISMATCH\":2,\"READABILITY_TOO_HIGH\":1,\"MCQ_CHOICE_COUNT\":12,\"VERIFIER_PICKED_DISTRACTOR\":1,\"ANSWER_NOT_IN_QUOTE\":3,\"TYPE_NOT_REQUESTED\":3,\"WORDS_TOO_LONG\":1,\"MCQ_DISTRACTOR_OFF_TOPIC\":1,\"ACT_ANSWER_NOT_IN_QUOTE\":1},\"duration_ms\":675009,\"model\":\"llama3.2:latest\",\"verifier_model\":\"llama3.2:latest\",\"prompt_version\":\"v1\"}', NULL, 'llama3.2:latest', 'llama3.2:latest', 'v1', NULL, '2026-10-08 09:53:32', '2026-10-08 10:04:47');

-- --------------------------------------------------------

--
-- Table structure for table `quiz_sets`
--

CREATE TABLE `quiz_sets` (
  `id` int(11) NOT NULL,
  `teacher_id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `subject_id` int(11) DEFAULT NULL,
  `grade_level` int(11) NOT NULL,
  `lesson_plan_id` int(11) DEFAULT NULL,
  `lesson_title` varchar(255) DEFAULT NULL,
  `ai_recommendation_id` int(11) DEFAULT NULL,
  `source` enum('ai','manual') NOT NULL DEFAULT 'manual',
  `status` enum('active','archived') NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `quiz_sets`
--

INSERT INTO `quiz_sets` (`id`, `teacher_id`, `title`, `subject_id`, `grade_level`, `lesson_plan_id`, `lesson_title`, `ai_recommendation_id`, `source`, `status`, `created_at`, `updated_at`) VALUES
(1, 2, 'Nouns and Verbs Quiz', 16, 1, 1, 'Nouns and Verbs', 1, 'ai', 'archived', '2026-10-06 02:49:13', '2026-10-08 05:50:28'),
(2, 2, 'Quiz: Nouns and Verbs', 16, 1, 1, 'Nouns and Verbs', 2, 'ai', 'archived', '2026-10-07 15:29:36', '2026-10-08 05:50:36'),
(3, 2, 'Quiz: Sample', 13, 1, 3, 'Sample', 6, 'ai', 'archived', '2026-10-08 00:09:22', '2026-10-08 00:10:12'),
(4, 2, 'Quiz: Problem Solving', 12, 1, 2, 'Problem Solving', 4, 'ai', 'active', '2026-10-08 00:10:33', '2026-10-08 00:10:33'),
(5, 2, 'Quiz: Adjective', 16, 1, 4, 'Adjective', 7, 'ai', 'archived', '2026-10-08 00:18:09', '2026-10-08 00:19:14'),
(6, 2, 'Quiz: Internet of Things', 16, 1, 5, 'Internet of Things', 8, 'ai', 'archived', '2026-10-08 00:21:02', '2026-10-08 00:22:46'),
(7, 2, 'Nouns and Verbs Quiz', 16, 1, 1, 'Nouns and Verbs', 10, 'ai', 'archived', '2026-10-08 01:01:56', '2026-10-08 05:50:08'),
(8, 2, 'Quiz — Nouns', 16, 1, 6, 'Nouns', NULL, 'ai', 'active', '2026-10-08 05:52:01', '2026-10-08 05:52:01'),
(9, 2, 'Nouns Quiz', 16, 1, 6, 'Nouns', 12, 'ai', 'active', '2026-10-09 00:50:41', '2026-10-09 00:50:41'),
(10, 2, 'Understanding Nouns, Verbs, and Adjectives', 13, 1, 3, 'Sample', 13, 'ai', 'active', '2026-10-09 03:49:59', '2026-10-09 03:49:59'),
(11, 2, 'Nouns Quiz', 16, 1, 6, 'Nouns', 17, 'ai', 'active', '2026-10-09 04:44:30', '2026-10-09 04:44:30');

-- --------------------------------------------------------

--
-- Table structure for table `quiz_submissions`
--

CREATE TABLE `quiz_submissions` (
  `id` int(11) NOT NULL,
  `assessment_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `share_token` varchar(32) NOT NULL,
  `answers` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`answers`)),
  `score` decimal(8,2) NOT NULL DEFAULT 0.00,
  `max_score` decimal(8,2) NOT NULL DEFAULT 0.00,
  `submitted_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `quiz_submissions`
--

INSERT INTO `quiz_submissions` (`id`, `assessment_id`, `student_id`, `share_token`, `answers`, `score`, `max_score`, `submitted_at`) VALUES
(1, 1, 5, 'dedf01239e971b65', '{\"student_id\":5,\"answers\":{\"1\":\"A person\",\"2\":\"To describe adverbs\",\"3\":\"To extend the meaning of verbs\",\"4\":\"To modify verbs\",\"5\":\"hgh\",\"6\":\"hnb\",\"7\":\"fgd\",\"8\":\"fd\",\"9\":\"c\",\"10\":\"c\"},\"detail\":[{\"question_id\":1,\"given\":\"A person\",\"correct\":false,\"points\":1},{\"question_id\":2,\"given\":\"To describe adverbs\",\"correct\":false,\"points\":1},{\"question_id\":3,\"given\":\"To extend the meaning of verbs\",\"correct\":true,\"points\":1},{\"question_id\":4,\"given\":\"To modify verbs\",\"correct\":false,\"points\":1},{\"question_id\":5,\"given\":\"hgh\",\"correct\":false,\"points\":1},{\"question_id\":6,\"given\":\"hnb\",\"correct\":false,\"points\":1},{\"question_id\":7,\"given\":\"fgd\",\"correct\":false,\"points\":1},{\"question_id\":8,\"given\":\"fd\",\"correct\":false,\"points\":1},{\"question_id\":9,\"given\":\"c\",\"correct\":false,\"points\":1},{\"question_id\":10,\"given\":\"c\",\"correct\":false,\"points\":1}],\"scored_at\":\"2026-10-06T02:51:49.301Z\"}', 1.00, 10.00, '2026-10-06 02:51:49'),
(2, 2, 5, '4b073a3aaec36a14', '{\"student_id\":5,\"answers\":{\"11\":\"A key concept from the lesson\",\"12\":\"An unrelated topic\",\"13\":\"An unrelated topic\",\"14\":\"A homework rule\",\"15\":\"gasd\",\"16\":\"sdfs\",\"17\":\"safs\",\"18\":\"sdgs\",\"19\":\"sfs\",\"20\":\"fsfs\"},\"detail\":[{\"question_id\":11,\"given\":\"A key concept from the lesson\",\"correct\":true,\"points\":1},{\"question_id\":12,\"given\":\"An unrelated topic\",\"correct\":false,\"points\":1},{\"question_id\":13,\"given\":\"An unrelated topic\",\"correct\":false,\"points\":1},{\"question_id\":14,\"given\":\"A homework rule\",\"correct\":false,\"points\":1},{\"question_id\":15,\"given\":\"gasd\",\"correct\":false,\"points\":1},{\"question_id\":16,\"given\":\"sdfs\",\"correct\":false,\"points\":1},{\"question_id\":17,\"given\":\"safs\",\"correct\":false,\"points\":1},{\"question_id\":18,\"given\":\"sdgs\",\"correct\":false,\"points\":2},{\"question_id\":19,\"given\":\"sfs\",\"correct\":false,\"points\":2},{\"question_id\":20,\"given\":\"fsfs\",\"correct\":false,\"points\":2}],\"scored_at\":\"2026-10-07T15:31:05.431Z\"}', 1.00, 13.00, '2026-10-07 15:31:05'),
(3, 4, 5, '6c412ed489a16b6a', '{\"student_id\":5,\"answers\":{\"22\":\"A key concept from the lesson\",\"23\":\"A key concept from the lesson\",\"24\":\"A key concept from the lesson\",\"25\":\"A key concept from the lesson\",\"26\":\"Key term from Problem Solving\",\"27\":\"Skill from Problem Solving\",\"28\":\"Skill from Problem Solving\",\"29\":\"concepts or steps from the lesson objectives\",\"30\":\"concepts or steps from the lesson objectives\",\"31\":\"concepts or steps from the lesson objectives\"},\"detail\":[{\"question_id\":22,\"given\":\"A key concept from the lesson\",\"correct\":true,\"points\":1},{\"question_id\":23,\"given\":\"A key concept from the lesson\",\"correct\":true,\"points\":1},{\"question_id\":24,\"given\":\"A key concept from the lesson\",\"correct\":true,\"points\":1},{\"question_id\":25,\"given\":\"A key concept from the lesson\",\"correct\":true,\"points\":1},{\"question_id\":26,\"given\":\"Key term from Problem Solving\",\"correct\":true,\"points\":1},{\"question_id\":27,\"given\":\"Skill from Problem Solving\",\"correct\":true,\"points\":1},{\"question_id\":28,\"given\":\"Skill from Problem Solving\",\"correct\":true,\"points\":1},{\"question_id\":29,\"given\":\"concepts or steps from the lesson objectives\",\"correct\":false,\"points\":1},{\"question_id\":30,\"given\":\"concepts or steps from the lesson objectives\",\"correct\":false,\"points\":1},{\"question_id\":31,\"given\":\"concepts or steps from the lesson objectives\",\"correct\":false,\"points\":1}],\"scored_at\":\"2026-10-08T00:13:31.411Z\"}', 7.00, 10.00, '2026-10-08 00:13:31'),
(4, 6, 5, 'b6711e7826711ab3', '{\"student_id\":5,\"answers\":{\"33\":\"A place\",\"34\":\"Both\",\"35\":\"Object pronoun\",\"36\":\"Subject pronoun\",\"37\":\"asgag\",\"38\":\"sapgm\",\"39\":\"pmsamf\",\"40\":\"ofmasom\",\"41\":\"momas\",\"42\":\"oema\"},\"detail\":[{\"question_id\":33,\"given\":\"A place\",\"correct\":false,\"points\":1},{\"question_id\":34,\"given\":\"Both\",\"correct\":false,\"points\":1},{\"question_id\":35,\"given\":\"Object pronoun\",\"correct\":false,\"points\":1},{\"question_id\":36,\"given\":\"Subject pronoun\",\"correct\":true,\"points\":1},{\"question_id\":37,\"given\":\"asgag\",\"correct\":false,\"points\":1},{\"question_id\":38,\"given\":\"sapgm\",\"correct\":false,\"points\":1},{\"question_id\":39,\"given\":\"pmsamf\",\"correct\":false,\"points\":1},{\"question_id\":40,\"given\":\"ofmasom\",\"correct\":false,\"points\":1},{\"question_id\":41,\"given\":\"momas\",\"correct\":false,\"points\":1},{\"question_id\":42,\"given\":\"oema\",\"correct\":false,\"points\":1}],\"scored_at\":\"2026-10-09T01:26:19.194Z\"}', 1.00, 10.00, '2026-10-09 01:26:19'),
(5, 7, 5, '6218a1ba91db0ac6', '{\"student_id\":5,\"answers\":{\"43\":\"A key concept from the lesson\",\"44\":\"A key concept from the lesson\",\"45\":\"A key concept from the lesson\",\"46\":\"A key concept from the lesson\",\"47\":\"asgalsm\",\"48\":\"oasmfma\",\"49\":\"masmfa\",\"50\":\"ofmoasm\",\"51\":\"mfasfooa\",\"52\":\"mfoasf\"},\"detail\":[{\"question_id\":43,\"given\":\"A key concept from the lesson\",\"correct\":true,\"points\":1},{\"question_id\":44,\"given\":\"A key concept from the lesson\",\"correct\":true,\"points\":1},{\"question_id\":45,\"given\":\"A key concept from the lesson\",\"correct\":true,\"points\":1},{\"question_id\":46,\"given\":\"A key concept from the lesson\",\"correct\":true,\"points\":1},{\"question_id\":47,\"given\":\"asgalsm\",\"correct\":false,\"points\":1},{\"question_id\":48,\"given\":\"oasmfma\",\"correct\":false,\"points\":1},{\"question_id\":49,\"given\":\"masmfa\",\"correct\":false,\"points\":1},{\"question_id\":50,\"given\":\"ofmoasm\",\"correct\":false,\"points\":1},{\"question_id\":51,\"given\":\"mfasfooa\",\"correct\":false,\"points\":1},{\"question_id\":52,\"given\":\"mfoasf\",\"correct\":false,\"points\":1}],\"scored_at\":\"2026-10-09T01:30:32.465Z\"}', 4.00, 10.00, '2026-10-09 01:30:32'),
(6, 9, 5, 'c6e44cd227513b8e', '{\"student_id\":5,\"answers\":{\"83\":\"A person\",\"84\":\"Neither\",\"85\":\"Object pronoun\",\"86\":\"Subject pronoun\",\"87\":\"aksmfam\",\"88\":\"mosamdoa\",\"89\":\"dasodma\",\"90\":\"aksmdoa\",\"91\":\"mdasmda\",\"92\":\"odmoamsdo\",\"93\":\"Things\",\"94\":\"Object\",\"95\":\"Adjectives\",\"96\":\"Nouns\",\"97\":\"Verb meaning\",\"98\":\"Parts of speech\",\"99\":\"A noun\",\"100\":\"A type of verb\",\"101\":\"A key concept from the lesson\",\"102\":\"A key concept from the lesson\",\"103\":\"A recess activity\",\"104\":\"An unrelated topic\",\"105\":\"fkasfma\",\"106\":\"dooamsod\",\"107\":\"omodmaosm\",\"108\":\"omsdoam\",\"109\":\"omasda\",\"110\":\"mdasodma\"},\"detail\":[{\"question_id\":83,\"given\":\"A person\",\"correct\":false,\"points\":1},{\"question_id\":84,\"given\":\"Neither\",\"correct\":false,\"points\":1},{\"question_id\":85,\"given\":\"Object pronoun\",\"correct\":false,\"points\":1},{\"question_id\":86,\"given\":\"Subject pronoun\",\"correct\":true,\"points\":1},{\"question_id\":87,\"given\":\"aksmfam\",\"correct\":false,\"points\":1},{\"question_id\":88,\"given\":\"mosamdoa\",\"correct\":false,\"points\":1},{\"question_id\":89,\"given\":\"dasodma\",\"correct\":false,\"points\":1},{\"question_id\":90,\"given\":\"aksmdoa\",\"correct\":false,\"points\":2},{\"question_id\":91,\"given\":\"mdasmda\",\"correct\":false,\"points\":2},{\"question_id\":92,\"given\":\"odmoamsdo\",\"correct\":false,\"points\":2},{\"question_id\":93,\"given\":\"Things\",\"correct\":false,\"points\":1},{\"question_id\":94,\"given\":\"Object\",\"correct\":false,\"points\":1},{\"question_id\":95,\"given\":\"Adjectives\",\"correct\":false,\"points\":1},{\"question_id\":96,\"given\":\"Nouns\",\"correct\":false,\"points\":1},{\"question_id\":97,\"given\":\"Verb meaning\",\"correct\":false,\"points\":1},{\"question_id\":98,\"given\":\"Parts of speech\",\"correct\":false,\"points\":1},{\"question_id\":99,\"given\":\"A noun\",\"correct\":false,\"points\":1},{\"question_id\":100,\"given\":\"A type of verb\",\"correct\":false,\"points\":1},{\"question_id\":101,\"given\":\"A key concept from the lesson\",\"correct\":true,\"points\":1},{\"question_id\":102,\"given\":\"A key concept from the lesson\",\"correct\":true,\"points\":1},{\"question_id\":103,\"given\":\"A recess activity\",\"correct\":false,\"points\":1},{\"question_id\":104,\"given\":\"An unrelated topic\",\"correct\":false,\"points\":1},{\"question_id\":105,\"given\":\"fkasfma\",\"correct\":false,\"points\":1},{\"question_id\":106,\"given\":\"dooamsod\",\"correct\":false,\"points\":1},{\"question_id\":107,\"given\":\"omodmaosm\",\"correct\":false,\"points\":1},{\"question_id\":108,\"given\":\"omsdoam\",\"correct\":false,\"points\":2},{\"question_id\":109,\"given\":\"omasda\",\"correct\":false,\"points\":2},{\"question_id\":110,\"given\":\"mdasodma\",\"correct\":false,\"points\":2}],\"scored_at\":\"2026-10-09T01:38:08.087Z\"}', 3.00, 34.00, '2026-10-09 01:38:08');

-- --------------------------------------------------------

--
-- Table structure for table `sms_queue`
--

CREATE TABLE `sms_queue` (
  `id` int(11) NOT NULL,
  `parent_id` int(11) DEFAULT NULL,
  `student_id` int(11) DEFAULT NULL,
  `phone` varchar(20) NOT NULL,
  `body` varchar(500) NOT NULL,
  `status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
  `attempts` int(11) NOT NULL DEFAULT 0,
  `last_error` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `sent_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `sms_queue`
--

INSERT INTO `sms_queue` (`id`, `parent_id`, `student_id`, `phone`, `body`, `status`, `attempts`, `last_error`, `created_at`, `sent_at`) VALUES
(1, 3, 5, '09708668466', 'ConnectED: Cams Lasr — Present (PM session), Grade 1-A, 2026-10-08.', 'sent', 1, 'DRY_RUN:itexmo', '2026-10-08 14:32:18', '2026-10-08 14:32:18'),
(2, 3, 5, '09708668466', 'ConnectED: Cams Lasr — Absent (PM session), Grade 1-A, 2026-10-08.', 'sent', 1, 'DRY_RUN:itexmo', '2026-10-08 14:35:11', '2026-10-08 14:35:11'),
(3, 11, 8, '09171234567', 'ConnectED: Ben Reyes — Present (PM session), Grade 1-A, 2026-10-08.', 'sent', 1, NULL, '2026-10-08 14:35:11', '2026-10-08 14:35:40'),
(4, 11, 7, '09171234567', 'ConnectED: Ana Santos — Present (PM session), Grade 1-A, 2026-10-08.', 'sent', 1, NULL, '2026-10-08 14:35:11', '2026-10-08 14:35:41'),
(5, 3, 5, '09708668466', 'ConnectED: Cams Lasr — Absent (AM session), Grade 1-A, 2026-10-08.', 'sent', 1, NULL, '2026-10-08 14:36:58', '2026-10-08 14:36:58'),
(6, 11, 8, '09171234567', 'ConnectED: Ben Reyes — Present (AM session), Grade 1-A, 2026-10-08.', 'sent', 1, NULL, '2026-10-08 14:36:58', '2026-10-08 14:36:59'),
(7, 3, 5, '09708668466', 'ConnectED: Cams Lasr — Late (PM session), Grade 1-A, 2026-10-08.', 'sent', 1, NULL, '2026-10-08 14:38:53', '2026-10-08 14:38:54'),
(8, 3, 5, '09708668466', 'ConnectED: Cams Lasr — Present (AM session), Grade 1-A, 2026-10-08.', 'sent', 1, NULL, '2026-10-08 14:42:35', '2026-10-08 14:42:36'),
(9, 11, 7, '09171234567', 'ConnectED: Ana Santos — Present (AM session), Grade 1-A, 2026-10-08.', 'sent', 1, NULL, '2026-10-08 14:42:35', '2026-10-08 14:42:36'),
(10, 3, 5, '09708668466', 'ConnectED: Cams Lasr — Present (AM session), Grade 1-A, 2026-10-09.', 'sent', 1, NULL, '2026-10-09 00:34:18', '2026-10-09 00:34:19'),
(11, 3, 5, '09708668466', 'ConnectED: Cams Lasr — Absent (AM session), Grade 1-A, 2026-10-09.', 'sent', 1, NULL, '2026-10-09 01:27:20', '2026-10-09 01:27:21'),
(12, 3, 5, '09708668466', 'ConnectED: New Announcement Posted', 'sent', 1, NULL, '2026-10-09 01:28:09', '2026-10-09 01:28:10'),
(13, 11, 7, '09171234567', 'ConnectED: New Announcement Posted', 'sent', 1, NULL, '2026-10-09 01:28:10', '2026-10-09 01:28:10'),
(14, 3, 5, '09708668466', 'ConnectED: Cams Lasr scored 4/10 on Quiz: Problem Solving.', 'sent', 1, NULL, '2026-10-09 01:30:32', '2026-10-09 01:30:33'),
(15, 3, 5, '09708668466', 'ConnectED: Cams Lasr scored 4/5 on Activity — Nouns.', 'sent', 1, NULL, '2026-10-09 01:31:31', '2026-10-09 01:31:32'),
(16, 3, 5, '09708668466', 'ConnectED: New Announcement Posted!', 'sent', 1, NULL, '2026-10-09 01:33:43', '2026-10-09 01:33:44'),
(17, 11, 7, '09171234567', 'ConnectED: New Announcement Posted!', 'sent', 1, NULL, '2026-10-09 01:33:44', '2026-10-09 01:33:44'),
(18, 3, 5, '09708668466', 'ConnectED: Cams Lasr scored 3/34 on Q1 Periodical Exam.', 'sent', 1, NULL, '2026-10-09 01:38:08', '2026-10-09 01:38:08'),
(19, 28, NULL, '09301846142', 'ConnectED: Your temporary password is 9qaFWHSA6Q. Sign in with your email, then change it. Do not share this password.', 'sent', 1, NULL, '2026-10-09 14:20:12', '2026-10-09 14:20:13'),
(20, 29, NULL, '09489321252', 'ConnectED: Your temporary password is W3dF9Eq2bn. Sign in with your email, then change it. Do not share this password.', 'sent', 1, NULL, '2026-10-09 15:43:35', '2026-10-09 15:43:35');

-- --------------------------------------------------------

--
-- Table structure for table `students`
--

CREATE TABLE `students` (
  `id` int(11) NOT NULL,
  `lrn` varchar(12) DEFAULT NULL,
  `first_name` varchar(100) NOT NULL,
  `middle_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) NOT NULL,
  `grade_level` int(11) NOT NULL,
  `section` varchar(10) NOT NULL,
  `dob` date DEFAULT NULL,
  `gender` enum('M','F') DEFAULT NULL,
  `STATUS` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `students`
--

INSERT INTO `students` (`id`, `lrn`, `first_name`, `middle_name`, `last_name`, `grade_level`, `section`, `dob`, `gender`, `STATUS`, `created_at`, `deleted_at`) VALUES
(5, '123443222222', 'Cams', 'M', 'Lasr', 1, 'A', NULL, 'F', 'active', '2026-08-17 05:12:58', NULL),
(7, '109876543210', 'Ana', 'A', 'Santos', 1, 'A', '2018-06-15', 'F', 'active', '2026-10-08 07:29:18', NULL),
(8, '109876543211', 'Ben', 'B', 'Reyes', 1, 'A', '2018-02-11', 'M', 'active', '2026-10-08 07:29:18', NULL),
(9, '109876543212', 'Cara', 'C', 'Cruz', 2, 'A', '2017-03-01', 'F', 'active', '2026-10-08 07:29:18', NULL),
(10, '109876543213', 'Diego', 'D', 'Flores', 3, 'Rosa', '2016-09-20', 'M', 'active', '2026-10-08 07:29:18', NULL),
(11, '109876543214', 'Ella', 'E', 'Garcia', 4, 'C', '2015-11-08', 'F', 'active', '2026-10-08 07:29:18', NULL),
(12, '109876543215', 'Felix', 'F', 'Navarro', 5, 'B', '2014-01-30', 'M', 'active', '2026-10-08 07:29:18', NULL),
(13, '109876543216', 'Gina', 'G', 'Torres', 6, 'C', '2013-07-19', 'F', 'inactive', '2026-10-08 07:29:18', '2026-10-08 07:56:21');

-- --------------------------------------------------------

--
-- Table structure for table `subjects`
--

CREATE TABLE `subjects` (
  `id` int(11) NOT NULL,
  `CODE` varchar(20) NOT NULL,
  `NAME` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `applicable_grades` varchar(20) DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `subjects`
--

INSERT INTO `subjects` (`id`, `CODE`, `NAME`, `description`, `applicable_grades`, `deleted_at`) VALUES
(12, 'MATH', 'Math', 'Problem-solving', '1-6', NULL),
(13, 'SCI', 'Science', 'Botany, Physics', '1-6', NULL),
(14, 'AP', 'Araling Panlipunan', 'History, Society, Law', NULL, NULL),
(15, 'MAPEH', 'Music, Arts, PE, Health', 'Music, Arts, PE, Health', NULL, NULL),
(16, 'ENG', 'English', NULL, '1-6', NULL),
(18, 'FIL', 'Filipino', NULL, '1-6', NULL),
(19, 'MAK', 'Makabansa', NULL, '1-6', NULL),
(20, 'GMRC', 'GMRC', NULL, '1-6', NULL),
(21, 'REL', 'Religion', NULL, '1-6', NULL),
(22, 'GEOM', 'Geometry', NULL, '1-6', NULL),
(23, 'GEOG', 'Geography', NULL, '1-6', NULL),
(24, 'READ', 'Reading', NULL, '1-6', NULL),
(25, 'COMP', 'Computer', NULL, '4-6', NULL),
(26, 'TLE', 'TLE', NULL, '4-6', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `teacher_assignments`
--

CREATE TABLE `teacher_assignments` (
  `id` int(11) NOT NULL,
  `teacher_id` int(11) NOT NULL,
  `subject_id` int(11) DEFAULT NULL,
  `grade_level` int(11) NOT NULL,
  `section` varchar(10) NOT NULL,
  `school_year` varchar(20) DEFAULT '2025-2026',
  `slot` enum('adviser','assistant','subject') NOT NULL DEFAULT 'subject'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `teacher_assignments`
--

INSERT INTO `teacher_assignments` (`id`, `teacher_id`, `subject_id`, `grade_level`, `section`, `school_year`) VALUES
(1, 2, NULL, 1, 'A', '2025-2026'),
(2, 2, NULL, 1, 'Mangga', '2025-2026'),
(3, 4, NULL, 2, 'Bonifacio', '2025-2026'),
(10, 6, 13, 5, 'NARRA', '2025-2026'),
(11, 5, NULL, 1, 'Mangga', '2025-2026'),
(12, 7, 13, 4, 'ORANGE', '2025-2026'),
(13, 7, 14, 5, 'NARRA', '2025-2026'),
(14, 8, NULL, 2, 'Bonifacio', '2025-2026'),
(15, 8, 12, 2, 'Bonifacio', '2025-2026'),
(16, 8, 13, 2, 'Bonifacio', '2025-2026'),
(17, 2, NULL, 1, 'Mangga', '2025-2026'),
(18, 2, NULL, 1, 'A', '2025-2026'),
(19, 14, 15, 5, 'B', '2025-2026'),
(20, 2, NULL, 3, 'Rosa', '2025-2026'),
(21, 2, 12, 3, 'Rosa', '2025-2026'),
(22, 2, 13, 3, 'Rosa', '2025-2026'),
(23, 2, 16, 3, 'Rosa', '2025-2026'),
(24, 16, 13, 6, 'C', '2025-2026'),
(25, 16, 16, 4, 'C', '2025-2026'),
(26, 17, NULL, 6, 'C', '2025-2026'),
(27, 19, NULL, 4, 'MANGO', '2025-2026'),
(28, 19, 16, 4, 'MANGO', '2025-2026'),
(29, 19, 12, 4, 'MANGO', '2025-2026'),
(30, 19, 15, 4, 'MANGO', '2025-2026'),
(31, 19, 13, 4, 'MANGO', '2025-2026'),
(32, 18, 16, 4, 'ORANGE', '2025-2026'),
(33, 18, 14, 5, 'B', '2025-2026'),
(34, 18, 12, 6, 'C', '2025-2026'),
(35, 19, 16, 4, 'LOVE', '2025-2026'),
(36, 19, 13, 4, 'LOVE', '2025-2026');

-- --------------------------------------------------------

--
-- Table structure for table `teacher_profiles`
--

CREATE TABLE `teacher_profiles` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `teaching_mode` enum('homeroom','subject','class_adviser','subject_teacher','both') DEFAULT 'homeroom',
  `homeroom_grade` int(11) DEFAULT NULL,
  `homeroom_section` varchar(10) DEFAULT NULL,
  `specialization` varchar(100) DEFAULT NULL,
  `subjects_taught` longtext DEFAULT NULL,
  `grades_handled` longtext DEFAULT NULL,
  `homeroom_role` enum('adviser','assistant') DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `teacher_profiles`
--

INSERT INTO `teacher_profiles` (`id`, `user_id`, `teaching_mode`, `homeroom_grade`, `homeroom_section`, `specialization`, `subjects_taught`, `grades_handled`) VALUES
(1, 2, 'both', 1, 'A', NULL, NULL, NULL),
(2, 4, 'class_adviser', 2, 'Bonifacio', NULL, NULL, '[2]'),
(3, 5, 'class_adviser', 1, 'Mangga', NULL, NULL, NULL),
(4, 6, 'subject_teacher', NULL, NULL, NULL, '[13]', '[5]'),
(5, 7, 'subject_teacher', NULL, NULL, NULL, '[13,14]', '[4,5]'),
(6, 8, 'both', 2, 'Bonifacio', NULL, '[12,13]', '[2]'),
(7, 14, 'subject_teacher', NULL, NULL, NULL, '[15]', '[5]'),
(8, 15, 'homeroom', NULL, NULL, NULL, '[12,13,16]', '[3]'),
(9, 16, 'subject_teacher', NULL, NULL, NULL, '[13,16]', '[4,6]'),
(10, 17, 'class_adviser', 6, 'C', NULL, NULL, NULL),
(11, 18, 'subject_teacher', NULL, NULL, NULL, '[16,12,15,13,14]', '[4,5,6]'),
(12, 19, 'both', 4, 'MANGO', NULL, NULL, NULL),
(13, 20, 'homeroom', NULL, NULL, NULL, '[16,13]', '[4]');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `role` enum('admin','teacher','parent') NOT NULL,
  `STATUS` enum('active','inactive') DEFAULT 'active',
  `must_change_password` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `avatar_url` varchar(500) DEFAULT NULL,
  `token_version` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `first_name`, `last_name`, `email`, `password_hash`, `phone`, `role`, `STATUS`, `must_change_password`, `created_at`, `avatar_url`, `token_version`) VALUES
(1, 'System', 'Admin', 'admin@usant.edu', '$2b$10$gendTIOhcEpY2aOOGg7w6.tmx7LlclD/6dht.TuujqjUjAlXX9l2i', '09170000000', 'admin', 'active', 0, '2026-08-05 11:08:03', '/assets/avatars/user_1_1786804257846.jpg', 0),
(2, 'Agnes', 'Cepe', 'agnesj.cepe@usant.edu.ph', '$2b$10$tfWf9284K5P09yNUWInQ7OGIe9vq5pZflZST./ItZjzknAAnZOi3m', '09123456789', 'teacher', 'active', 0, '2026-08-05 11:53:45', NULL, 0),
(3, 'Cindy', 'Beralde', 'ciberalde@usant.edu', '$2b$10$uZAaHLY9sNFUeEKDHY26KOpwIP80H1vyEyGFt9TbSQT/K/Vtm1DVa', '09708668466', 'parent', 'active', 0, '2026-08-05 12:13:58', '/assets/avatars/user_3_1786367888467.jpg', 0),
(4, 'Ligaya', 'Haha', 'ligaya@usant.edu.ph', '$2b$10$RjYc5BT.PWiOLyi5AyHYAOy/IBaFIlnhOvlGX.e26bMPby.9sEZNC', '09912345678', 'teacher', 'inactive', 0, '2026-08-05 13:53:59', NULL, 0),
(5, 'Bernadette', 'Cepe', 'badette@usant.edu.ph', '$2b$10$nLP3yOV9vPtG39qFQkePY.LF9Vkzd6lQ9VZiW2m8l2X/J..t7ubPq', '72817491378591', 'teacher', 'active', 0, '2026-08-05 13:57:20', NULL, 0),
(6, 'Jobert', 'Follero', 'jobert@usant.edu.ph', '$2b$10$2Q1tWwNWLzcPjBeqGl2ueu0oZIZEqNaMALqIyMVMNpVgx5KvmqOLm', '09123123123', 'teacher', 'inactive', 0, '2026-08-14 02:32:17', NULL, 0),
(7, 'Jane', 'Doe', 'janedoe@usant.edu.ph', '$2b$10$rhH/17fzTLtIXYqyplVyruG.ad2EOyYBjQcFAlAnxyRnoY/xnFHcC', '09915521939', 'teacher', 'active', 0, '2026-08-15 03:02:46', NULL, 0),
(8, 'John', 'Doe', 'johndoe@usant.edu.ph', '$2b$10$2c9uUd/HHSrTObOEthZ6wuM6u9KwRRdNKYonQIDOvZgW2RUqaktdW', '0991255678439', 'teacher', 'inactive', 0, '2026-08-15 07:33:36', NULL, 0),
(11, 'Sample', 'Parent', 'sample.parent@usant.edu', '$2b$10$HQC44z3mjMB5lu/yPq2KK.l.UdLEcD2q44i.7ffMa6WwzNLqIFzRG', '09171234567', 'parent', 'active', 0, '2026-10-08 07:28:12', NULL, 0),
(12, 'Sample', 'Parent Two', 'sample.parent2@usant.edu', '$2b$10$0qDHN2UtT7COClDGi1z.L.XwebjNh81maZM3LYs6ERN4lgUj6Itpm', '09171234568', 'parent', 'active', 1, '2026-10-08 07:28:13', NULL, 0),
(13, 'Sample', 'Parent Three', 'sample.parent3@usant.edu', '$2b$10$PliIwkocONQQiqSinKyaiuIjPAFkEIhBLl7S0jcxGLzTDuvcXfxNO', '09171234569', 'parent', 'active', 1, '2026-10-08 07:28:13', NULL, 0),
(14, 'Sample', 'Teacher', 'sample.teacher@usant.edu', '$2b$10$FdzImr2znNySFZGSwnnR4OanOBGOo5FEbG6fMFakmHVXn/K8tSauu', '09182234567', 'teacher', 'inactive', 1, '2026-10-08 07:28:13', NULL, 0),
(15, 'Sample', 'Adviser', 'sample.adviser@usant.edu', '$2b$10$zWClZR48GMfuTHluh25dWOUfThbAGU/BDsyY910.bftCPGtmfnDZe', '09182234568', 'teacher', 'inactive', 1, '2026-10-08 07:28:13', NULL, 0),
(16, 'Sample', 'Subjects', 'sample.subjects@usant.edu', '$2b$10$/L/MqXvDMnoLaDjSixZFCu/KXk5eNNrXsSJewGD.DTeuAy.432XOa', '09182234569', 'teacher', 'inactive', 1, '2026-10-08 07:28:14', NULL, 0),
(17, 'Argill', 'TEacher', 'p2123@usant.edu.ph', '$2b$10$E.AV9IquU5.j4hHBZ.Kq8e/c2b48kk1SErGD8SqtxByiDTWP.LOqO', '09222555100', 'teacher', 'active', 1, '2026-10-08 07:33:08', NULL, 0),
(18, 'Sample', 'Lang', 'sample@usant.edu.ph', '$2b$10$u79XpXdjehSpE6Wh02wN8uHwK7ST8ublFRGbd6Tzb34sBXGlqb10m', '09148142752', 'teacher', 'inactive', 1, '2026-10-09 02:44:21', NULL, 0),
(19, 'Argill', 'Bonita', 'argill@usant.edu.ph', '$2b$10$cQY/3R5qtnNiD/YeiJw0l.mGRId0wLUw3.SPBjvbQutbjAjUuYHjm', NULL, 'teacher', 'active', 0, '2026-10-09 02:52:46', NULL, 0),
(20, 'Jen', 'Tal', 'jen@usant.edu.ph', '$2b$10$gnghqBbT.//Igb52La/62.bO1y3EeR430uPmVY4p8WORegvrf/akq', '09222555100', 'teacher', 'inactive', 1, '2026-10-09 03:08:10', NULL, 0),
(22, 'Argill', 'Bonita', 'argillertbonita@gmail.com', '$2b$10$ujwkKQ56xue3Koy6E60AwOeFN29PTV4B0vRVQXKWp4DwvCHPasIwu', '09153983889', 'parent', 'inactive', 1, '2026-10-09 05:22:28', NULL, 0),
(23, 'Jobert', 'Follero', 'berto@gmail.com', '$2b$10$Dj6rcg6BFGo8d.2essMn6.vVPiiJuX5YA8PufoKfVbWyX.HiDwUou', '09153983889', 'parent', 'inactive', 1, '2026-10-09 05:40:34', NULL, 0),
(24, 'Jobert', 'Follero', 'jobert@gmail.com', '$2b$10$MZdtLS6W3txtJr5uyGprG.uf8Hpg3qGb93CyXe37L.tmpx6ogs5QW', '09153983889', 'parent', 'active', 1, '2026-10-09 05:43:23', NULL, 0),
(25, 'Jobert', 'Foll', 'follero@gmail.com', '$2b$10$cbUoUBdFnkV9CYLaZcGJzO5HW0D4nU7xKC2vF3Zt7u8CWD8ZlXCui', '09107197030', 'parent', 'active', 1, '2026-10-09 05:44:34', NULL, 0),
(26, 'Cindy', 'Beralde', 'cindyberalde@gmail.com', '$2b$10$PZvEQzN8e8tOg05na4kNmuj4WwYWdHhHT63J8uJiXMUvAQnhZpiJK', '09107197030', 'parent', 'active', 1, '2026-10-09 06:00:23', NULL, 0),
(27, 'Joe', 'Fol', 'bertofollero@gmail.com', '$2b$10$CsHI1RuCDRgwqJuKlmnkGeU/6GwuOekUnkXuQS6xuafUU4WdciuKK', '09153983889', 'parent', 'active', 1, '2026-10-09 06:03:22', NULL, 0),
(28, 'Sunoo', 'Quart', 'alexisbanana58@gmail.com', '$2b$10$HDhkypsMsrIYWAgThN89huHDpBt8QOEtIexvZ6/6kppwoiUzIWaXS', '09301846142', 'parent', 'active', 1, '2026-10-09 14:20:07', NULL, 0),
(29, 'Jen', 'Talagtag', 'jennylyntalagtag780@gmail.com', '$2b$10$Eij2oUWt4Z8I7cD1pAkYKOrUrPSy3NCfJJzNcu3imSaomDJwAYM6i', '09489321252', 'parent', 'active', 1, '2026-10-09 15:43:30', NULL, 0);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `activity_log`
--
ALTER TABLE `activity_log`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_user_id` (`user_id`);

--
-- Indexes for table `ai_recommendations`
--
ALTER TABLE `ai_recommendations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_ai_rec_teacher` (`teacher_id`,`status`),
  ADD KEY `idx_ai_rec_lesson` (`lesson_plan_id`);

--
-- Indexes for table `announcements`
--
ALTER TABLE `announcements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `sender_id` (`sender_id`);

--
-- Indexes for table `announcement_reads`
--
ALTER TABLE `announcement_reads`
  ADD PRIMARY KEY (`user_id`,`announcement_id`),
  ADD KEY `announcement_id` (`announcement_id`);

--
-- Indexes for table `app_settings`
--
ALTER TABLE `app_settings`
  ADD PRIMARY KEY (`setting_key`);

--
-- Indexes for table `assessments`
--
ALTER TABLE `assessments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_assessments_share_token` (`share_token`),
  ADD KEY `subject_id` (`subject_id`),
  ADD KEY `created_by` (`created_by`);

--
-- Indexes for table `assessment_questions`
--
ALTER TABLE `assessment_questions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_aq_assessment` (`assessment_id`),
  ADD KEY `idx_aq_bank` (`question_bank_id`);

--
-- Indexes for table `assessment_scores`
--
ALTER TABLE `assessment_scores`
  ADD PRIMARY KEY (`id`),
  ADD KEY `assessment_id` (`assessment_id`),
  ADD KEY `student_id` (`student_id`);

--
-- Indexes for table `attendance`
--
ALTER TABLE `attendance`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_attendance_slot` (`student_id`,`DATE`,`session`,`subject_key`),
  ADD KEY `idx_attendance_student` (`student_id`),
  ADD KEY `idx_attendance_subject` (`subject_id`),
  ADD KEY `recorded_by` (`recorded_by`);

--
-- Indexes for table `concerns`
--
ALTER TABLE `concerns`
  ADD PRIMARY KEY (`id`),
  ADD KEY `parent_id` (`parent_id`),
  ADD KEY `teacher_id` (`teacher_id`),
  ADD KEY `student_id` (`student_id`);

--
-- Indexes for table `concern_reads`
--
ALTER TABLE `concern_reads`
  ADD PRIMARY KEY (`user_id`,`concern_id`),
  ADD KEY `idx_concern_reads_concern` (`concern_id`);

--
-- Indexes for table `concern_replies`
--
ALTER TABLE `concern_replies`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_concern_replies_concern` (`concern_id`),
  ADD KEY `idx_concern_replies_sender` (`sender_id`);

--
-- Indexes for table `lesson_plans`
--
ALTER TABLE `lesson_plans`
  ADD PRIMARY KEY (`id`),
  ADD KEY `subject_id` (`subject_id`),
  ADD KEY `uploaded_by` (`uploaded_by`);

--
-- Indexes for table `messages`
--
ALTER TABLE `messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `sender_id` (`sender_id`),
  ADD KEY `receiver_id` (`receiver_id`),
  ADD KEY `student_id` (`student_id`);

--
-- Indexes for table `parent_profiles`
--
ALTER TABLE `parent_profiles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `user_id` (`user_id`);

--
-- Indexes for table `parent_student_links`
--
ALTER TABLE `parent_student_links`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `parent_id` (`parent_id`,`student_id`),
  ADD KEY `student_id` (`student_id`);

--
-- Indexes for table `question_bank`
--
ALTER TABLE `question_bank`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_qb_teacher` (`teacher_id`,`status`),
  ADD KEY `idx_qb_set` (`quiz_set_id`);

--
-- Indexes for table `quizgen_facts`
--
ALTER TABLE `quizgen_facts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_qg_facts_lesson_hash` (`lesson_plan_id`,`file_hash`);

--
-- Indexes for table `quizgen_items`
--
ALTER TABLE `quizgen_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_qg_items_run` (`run_id`,`kind`,`sort_order`),
  ADD KEY `idx_qg_items_teacher` (`teacher_id`);

--
-- Indexes for table `quizgen_rejections`
--
ALTER TABLE `quizgen_rejections`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_qg_rej_run` (`run_id`);

--
-- Indexes for table `quizgen_runs`
--
ALTER TABLE `quizgen_runs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_qg_runs_lesson` (`lesson_plan_id`),
  ADD KEY `idx_qg_runs_teacher` (`teacher_id`,`status`);

--
-- Indexes for table `quiz_sets`
--
ALTER TABLE `quiz_sets`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_qs_teacher` (`teacher_id`,`status`),
  ADD KEY `idx_qs_grade` (`teacher_id`,`grade_level`);

--
-- Indexes for table `quiz_submissions`
--
ALTER TABLE `quiz_submissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_quiz_sub_assessment_student` (`assessment_id`,`student_id`),
  ADD KEY `idx_quiz_sub_token` (`share_token`);

--
-- Indexes for table `sms_queue`
--
ALTER TABLE `sms_queue`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sms_status_created` (`status`,`created_at`);

--
-- Indexes for table `students`
--
ALTER TABLE `students`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `lrn` (`lrn`);

--
-- Indexes for table `subjects`
--
ALTER TABLE `subjects`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `CODE` (`CODE`),
  ADD UNIQUE KEY `uq_subjects_name` (`NAME`);

--
-- Indexes for table `teacher_assignments`
--
ALTER TABLE `teacher_assignments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `teacher_id` (`teacher_id`),
  ADD KEY `subject_id` (`subject_id`),
  ADD KEY `idx_ta_grade_section` (`grade_level`,`section`);

--
-- Indexes for table `teacher_profiles`
--
ALTER TABLE `teacher_profiles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `user_id` (`user_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `activity_log`
--
ALTER TABLE `activity_log`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=119;

--
-- AUTO_INCREMENT for table `ai_recommendations`
--
ALTER TABLE `ai_recommendations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT for table `announcements`
--
ALTER TABLE `announcements`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `assessments`
--
ALTER TABLE `assessments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `assessment_questions`
--
ALTER TABLE `assessment_questions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=111;

--
-- AUTO_INCREMENT for table `assessment_scores`
--
ALTER TABLE `assessment_scores`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `attendance`
--
ALTER TABLE `attendance`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=26;

--
-- AUTO_INCREMENT for table `concerns`
--
ALTER TABLE `concerns`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `concern_replies`
--
ALTER TABLE `concern_replies`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `lesson_plans`
--
ALTER TABLE `lesson_plans`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `messages`
--
ALTER TABLE `messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `parent_profiles`
--
ALTER TABLE `parent_profiles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT for table `parent_student_links`
--
ALTER TABLE `parent_student_links`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `question_bank`
--
ALTER TABLE `question_bank`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=172;

--
-- AUTO_INCREMENT for table `quizgen_facts`
--
ALTER TABLE `quizgen_facts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT for table `quizgen_items`
--
ALTER TABLE `quizgen_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `quizgen_rejections`
--
ALTER TABLE `quizgen_rejections`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=50;

--
-- AUTO_INCREMENT for table `quizgen_runs`
--
ALTER TABLE `quizgen_runs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `quiz_sets`
--
ALTER TABLE `quiz_sets`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `quiz_submissions`
--
ALTER TABLE `quiz_submissions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `sms_queue`
--
ALTER TABLE `sms_queue`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT for table `students`
--
ALTER TABLE `students`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `subjects`
--
ALTER TABLE `subjects`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT for table `teacher_assignments`
--
ALTER TABLE `teacher_assignments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=37;

--
-- AUTO_INCREMENT for table `teacher_profiles`
--
ALTER TABLE `teacher_profiles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=30;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `announcements`
--
ALTER TABLE `announcements`
  ADD CONSTRAINT `announcements_ibfk_1` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `announcement_reads`
--
ALTER TABLE `announcement_reads`
  ADD CONSTRAINT `announcement_reads_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `announcement_reads_ibfk_2` FOREIGN KEY (`announcement_id`) REFERENCES `announcements` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `assessments`
--
ALTER TABLE `assessments`
  ADD CONSTRAINT `assessments_ibfk_1` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `assessments_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `assessment_scores`
--
ALTER TABLE `assessment_scores`
  ADD CONSTRAINT `assessment_scores_ibfk_1` FOREIGN KEY (`assessment_id`) REFERENCES `assessments` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `assessment_scores_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `attendance`
--
ALTER TABLE `attendance`
  ADD CONSTRAINT `attendance_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `attendance_ibfk_2` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `concerns`
--
ALTER TABLE `concerns`
  ADD CONSTRAINT `concerns_ibfk_1` FOREIGN KEY (`parent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `concerns_ibfk_2` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `concerns_ibfk_3` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `lesson_plans`
--
ALTER TABLE `lesson_plans`
  ADD CONSTRAINT `lesson_plans_ibfk_1` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `lesson_plans_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `messages`
--
ALTER TABLE `messages`
  ADD CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `messages_ibfk_2` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `messages_ibfk_3` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `parent_profiles`
--
ALTER TABLE `parent_profiles`
  ADD CONSTRAINT `parent_profiles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `parent_student_links`
--
ALTER TABLE `parent_student_links`
  ADD CONSTRAINT `parent_student_links_ibfk_1` FOREIGN KEY (`parent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `parent_student_links_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `teacher_assignments`
--
ALTER TABLE `teacher_assignments`
  ADD CONSTRAINT `teacher_assignments_ibfk_1` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `teacher_assignments_ibfk_2` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `teacher_profiles`
--
ALTER TABLE `teacher_profiles`
  ADD CONSTRAINT `teacher_profiles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
